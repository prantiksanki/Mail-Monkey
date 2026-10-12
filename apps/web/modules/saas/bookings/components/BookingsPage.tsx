"use client";

import { Alert, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	CalendarIcon,
	CheckIcon,
	MailIcon,
	VideoIcon,
	XIcon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
	PENDING: "Awaiting your response",
	ACCEPTING: "Finishing setup — retry if stuck",
	CONFIRMED: "Confirmed",
};

const STATUS_STYLES: Record<string, string> = {
	PENDING: "bg-warning/15 text-warning",
	ACCEPTING: "bg-warning/15 text-warning",
	CONFIRMED: "bg-success/15 text-success",
};

export function BookingsPage() {
	const queryClient = useQueryClient();
	const [declineTarget, setDeclineTarget] = useState<string | null>(null);

	const bookingsQuery = useQuery(
		orpc.creatorProfiles.listMyBookings.queryOptions(),
	);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: orpc.creatorProfiles.listMyBookings.key(),
		});

	const acceptMutation = useMutation(
		orpc.creatorProfiles.acceptBooking.mutationOptions({
			onSuccess: (result) => {
				if (result.status === "ok") {
					toast.success(
						"Booking confirmed — meeting created and email sent.",
					);
				} else if (
					result.status === "needsGoogleMailbox" ||
					result.status === "needsReconnect"
				) {
					toast.error(
						"Connect a Google mailbox (with Calendar access) to accept bookings.",
					);
				} else if (result.status === "serviceDisabled") {
					toast.error(
						"Google Calendar isn't enabled for this account.",
					);
				} else if (result.status === "emailFailed") {
					toast.error(
						"Meeting created, but the confirmation email failed. Click Accept again to retry sending it.",
					);
				} else {
					toast.error("Couldn't create the meeting. Try again.");
				}
				invalidate();
			},
			onError: () => {
				toast.error("Something went wrong.");
				invalidate();
			},
		}),
	);

	const declineMutation = useMutation(
		orpc.creatorProfiles.declineBooking.mutationOptions({
			onSuccess: () => {
				toast.success("Booking declined.");
				setDeclineTarget(null);
				invalidate();
			},
			onError: () => {
				toast.error("Couldn't decline the booking. Try again.");
			},
		}),
	);

	return (
		<div className="container max-w-3xl py-8">
			<div className="mb-6">
				<h1 className="font-serif text-3xl leading-none tracking-tight">
					Bookings
				</h1>
				<p className="mt-2 text-foreground/60 text-sm">
					Upcoming meetings booked through your public page.
				</p>
			</div>

			{bookingsQuery.isLoading && (
				<div className="flex flex-col gap-3">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-20 w-full" />
				</div>
			)}

			{bookingsQuery.isError && (
				<Alert variant="error">
					<AlertTitle>Couldn't load your bookings.</AlertTitle>
				</Alert>
			)}

			{bookingsQuery.data && bookingsQuery.data.length === 0 && (
				<div className="flex flex-col items-center gap-2 rounded-2xl border border-border border-dashed py-16 text-center">
					<CalendarIcon className="size-8 text-foreground/30" />
					<p className="font-medium text-sm">No upcoming bookings</p>
					<p className="max-w-xs text-foreground/60 text-sm">
						When someone books time through your public page, it'll
						show up here.
					</p>
				</div>
			)}

			{bookingsQuery.data && bookingsQuery.data.length > 0 && (
				<div className="flex flex-col gap-3">
					{bookingsQuery.data.map((booking) => {
						const isPending =
							booking.status === "PENDING" ||
							booking.status === "ACCEPTING";
						const isAccepting =
							acceptMutation.isPending &&
							acceptMutation.variables?.bookingId === booking.id;
						const isDeclining =
							declineMutation.isPending &&
							declineMutation.variables?.bookingId === booking.id;

						return (
							<div
								key={booking.id}
								className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
							>
								<div className="flex items-center gap-3">
									<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
										<CalendarIcon className="size-4.5" />
									</div>
									<div>
										<p className="font-medium text-sm">
											{booking.visitorName}
										</p>
										<p className="flex items-center gap-1 text-foreground/60 text-xs">
											<MailIcon className="size-3" />
											{booking.visitorEmail}
										</p>
										{booking.note && (
											<p className="mt-1 max-w-md text-foreground/70 text-xs">
												{booking.note}
											</p>
										)}
										<span
											className={`mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] ${STATUS_STYLES[booking.status] ?? ""}`}
										>
											{STATUS_LABELS[booking.status] ??
												booking.status}
										</span>
										{booking.status === "CONFIRMED" &&
											(booking.meetLink ? (
												<a
													href={booking.meetLink}
													target="_blank"
													rel="noopener noreferrer"
													className="mt-1.5 flex w-fit items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 font-medium text-primary-foreground text-xs hover:opacity-90"
												>
													<VideoIcon className="size-3.5" />
													Join Google Meet
												</a>
											) : (
												<p className="mt-1.5 text-foreground/50 text-xs">
													No meeting link — this
													booking was confirmed before
													the meeting workflow was
													added.
												</p>
											))}
									</div>
								</div>

								<div className="flex shrink-0 items-center gap-3">
									<div className="text-right">
										<p className="font-medium text-sm">
											{new Date(
												booking.startsAt,
											).toLocaleDateString(undefined, {
												weekday: "short",
												month: "short",
												day: "numeric",
											})}
										</p>
										<p className="text-foreground/60 text-xs">
											{new Date(
												booking.startsAt,
											).toLocaleTimeString(undefined, {
												hour: "numeric",
												minute: "2-digit",
											})}
											{booking.paid && (
												<span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
													Paid
												</span>
											)}
										</p>
									</div>

									{isPending && (
										<div className="flex items-center gap-2">
											<Button
												size="sm"
												variant="outline"
												disabled={
													isAccepting || isDeclining
												}
												onClick={() =>
													setDeclineTarget(booking.id)
												}
											>
												<XIcon className="size-3.5" />
												Decline
											</Button>
											<Button
												size="sm"
												loading={isAccepting}
												disabled={isDeclining}
												onClick={() =>
													acceptMutation.mutate({
														bookingId: booking.id,
													})
												}
											>
												<CheckIcon className="size-3.5" />
												{booking.status === "ACCEPTING"
													? "Retry"
													: "Accept"}
											</Button>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			<Dialog
				open={declineTarget !== null}
				onOpenChange={(open) => !open && setDeclineTarget(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Decline this booking?</DialogTitle>
						<DialogDescription>
							The visitor will be emailed a notice and the time
							slot will be released for others to request.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeclineTarget(null)}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							loading={declineMutation.isPending}
							onClick={() =>
								declineTarget &&
								declineMutation.mutate({
									bookingId: declineTarget,
								})
							}
						>
							Decline booking
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
