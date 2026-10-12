"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { createBookingSchema } from "@repo/api/modules/creator-profiles/types";
import { config as paymentsConfig } from "@repo/payments/config";
import { cn } from "@repo/ui";
import { Alert, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	ClockIcon,
	GlobeIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfMonth(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
	const d = new Date(date);
	d.setHours(0, 0, 0, 0);
	return d;
}

function dateKey(date: Date) {
	return date.toDateString();
}

/** Mon-first grid: leading blanks before the 1st, one cell per day of month. */
function buildMonthGrid(monthStart: Date) {
	const year = monthStart.getFullYear();
	const month = monthStart.getMonth();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	// getDay(): 0=Sun..6=Sat -> shift so Mon=0..Sun=6
	const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;

	const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
	for (let day = 1; day <= daysInMonth; day++) {
		cells.push(new Date(year, month, day));
	}
	return cells;
}

export function BookingPageContent({
	username,
	displayName,
	meetingLengthMinutes,
	paidBookingEnabled,
}: {
	username: string;
	displayName: string;
	meetingLengthMinutes: number;
	paidBookingEnabled?: boolean;
}) {
	const t = useTranslations();
	const router = useRouter();
	const [visibleMonth, setVisibleMonth] = useState(() =>
		startOfMonth(new Date()),
	);
	const [selectedDay, setSelectedDay] = useState<Date | null>(null);
	const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
	const [isRedirecting, setIsRedirecting] = useState(false);

	const today = useMemo(() => startOfDay(new Date()), []);
	const timeZone = useMemo(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone,
		[],
	);

	const { from, to } = useMemo(() => {
		const rangeStart = visibleMonth < today ? today : visibleMonth;
		const rangeEnd = new Date(
			visibleMonth.getFullYear(),
			visibleMonth.getMonth() + 1,
			0,
			23,
			59,
			59,
		);
		return { from: rangeStart, to: rangeEnd };
	}, [visibleMonth, today]);

	const slotsQuery = useQuery(
		orpc.creatorProfiles.getAvailableSlots.queryOptions({
			input: { username, from, to },
		}),
	);

	const bookingMutation = useMutation(
		orpc.creatorProfiles.createBooking.mutationOptions(),
	);
	const checkoutMutation = useMutation(
		orpc.creatorProfiles.createPaidBookingCheckout.mutationOptions(),
	);

	const form = useForm({
		resolver: zodResolver(createBookingSchema),
		defaultValues: {
			username,
			visitorName: "",
			visitorEmail: "",
			note: "",
			startsAt: undefined as unknown as Date,
		},
	});

	const slotsByDay = useMemo(() => {
		const groups = new Map<
			string,
			{ startsAt: string; endsAt: string }[]
		>();
		for (const slot of slotsQuery.data ?? []) {
			const key = dateKey(new Date(slot.startsAt));
			const existing = groups.get(key) ?? [];
			existing.push(slot);
			groups.set(key, existing);
		}
		return groups;
	}, [slotsQuery.data]);

	const monthCells = useMemo(
		() => buildMonthGrid(visibleMonth),
		[visibleMonth],
	);

	const goToMonth = (offset: number) => {
		setVisibleMonth(
			(prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1),
		);
		setSelectedDay(null);
	};

	const onSubmit = form.handleSubmit(async (values) => {
		const payload = {
			...values,
			startsAt: new Date(selectedSlot as string),
		};

		try {
			if (paidBookingEnabled) {
				const { checkoutUrl } =
					await checkoutMutation.mutateAsync(payload);
				setIsRedirecting(true);
				window.location.href = checkoutUrl;
				return;
			}
			await bookingMutation.mutateAsync(payload);
		} catch {
			form.setError("root", {
				message: t("profile.booking.notifications.error"),
			});
		}
	});

	useEffect(() => {
		if (!bookingMutation.isSuccess) {
			return;
		}
		const cancelToken = bookingMutation.data?.cancelToken;
		toast.success(t("profile.booking.notifications.success"), {
			action: cancelToken
				? {
						label: t("profile.booking.cancelLink"),
						onClick: () =>
							router.push(
								`/bookings/cancel?token=${cancelToken}`,
							),
					}
				: undefined,
			duration: 8000,
		});
		router.push(`/u/${username}`);
	}, [bookingMutation.isSuccess, bookingMutation.data, router, username, t]);

	if (bookingMutation.isSuccess) {
		return null;
	}

	const monthLabel = visibleMonth.toLocaleDateString(undefined, {
		month: "long",
		year: "numeric",
	});
	const isCurrentMonth =
		visibleMonth.getFullYear() === today.getFullYear() &&
		visibleMonth.getMonth() === today.getMonth();

	if (selectedSlot) {
		return (
			<div className="mx-auto max-w-md">
				<Form {...form}>
					<form
						onSubmit={onSubmit}
						className="flex flex-col items-stretch gap-4"
					>
						<div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm">
							<span>
								{new Date(selectedSlot).toLocaleString(
									undefined,
									{
										weekday: "short",
										month: "short",
										day: "numeric",
										hour: "numeric",
										minute: "2-digit",
									},
								)}{" "}
								· {meetingLengthMinutes} min
								{paidBookingEnabled &&
									` · $${paymentsConfig.paidBooking.amount}`}
							</span>
							<button
								type="button"
								onClick={() => setSelectedSlot(null)}
								className="text-foreground/60 underline underline-offset-2"
							>
								{t("profile.booking.changeTime")}
							</button>
						</div>

						{form.formState.errors.root?.message && (
							<Alert variant="error">
								<AlertTitle>
									{form.formState.errors.root.message}
								</AlertTitle>
							</Alert>
						)}

						<FormField
							control={form.control}
							name="visitorName"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("profile.booking.name")}
									</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="visitorEmail"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("profile.booking.email")}
									</FormLabel>
									<FormControl>
										<Input {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="note"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("profile.booking.note")}
									</FormLabel>
									<FormControl>
										<Textarea {...field} />
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button
							type="submit"
							className="w-full"
							variant="primary"
							loading={
								form.formState.isSubmitting || isRedirecting
							}
						>
							{paidBookingEnabled
								? t("profile.booking.confirmAndPay", {
										amount: `$${paymentsConfig.paidBooking.amount}`,
									})
								: t("profile.booking.confirm")}
						</Button>
					</form>
				</Form>
			</div>
		);
	}

	const selectedDaySlots = selectedDay
		? (slotsByDay.get(dateKey(selectedDay)) ?? [])
		: [];

	return (
		<div className="mx-auto grid max-w-4xl grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-[240px_1fr_auto]">
			<div className="flex flex-col gap-4 border-border border-b p-6 md:border-r md:border-b-0">
				<Link
					href={`/u/${username}`}
					className="text-foreground/60 text-sm hover:text-foreground"
				>
					&larr; {displayName}
				</Link>
				<div>
					<p className="text-foreground/50 text-sm">{displayName}</p>
					<h1 className="font-semibold text-xl">
						{t("profile.booking.title")}
					</h1>
				</div>
				<div className="flex items-center gap-2 text-foreground/70 text-sm">
					<ClockIcon className="size-4" />
					{meetingLengthMinutes} min
					{paidBookingEnabled &&
						` · $${paymentsConfig.paidBooking.amount}`}
				</div>
			</div>

			<div className="p-6">
				<div className="mb-4 flex items-center justify-between">
					<button
						type="button"
						onClick={() => goToMonth(-1)}
						disabled={isCurrentMonth}
						aria-label="Previous month"
						className="rounded-full border border-border p-1.5 disabled:cursor-not-allowed disabled:opacity-30 hover:bg-background"
					>
						<ChevronLeftIcon className="size-4" />
					</button>
					<p className="font-semibold text-sm">{monthLabel}</p>
					<button
						type="button"
						onClick={() => goToMonth(1)}
						aria-label="Next month"
						className="rounded-full border border-border p-1.5 hover:bg-background"
					>
						<ChevronRightIcon className="size-4" />
					</button>
				</div>

				<div className="grid grid-cols-7 gap-1 text-center">
					{WEEKDAY_LABELS.map((label) => (
						<span
							key={label}
							className="py-1 text-foreground/40 text-xs uppercase"
						>
							{label}
						</span>
					))}
					{monthCells.map((date, i) => {
						if (!date) {
							return <span key={`blank-${i}`} />;
						}
						const key = dateKey(date);
						const hasSlots = (slotsByDay.get(key)?.length ?? 0) > 0;
						const isPast = date < today;
						const isSelected =
							selectedDay && dateKey(selectedDay) === key;

						return (
							<button
								key={key}
								type="button"
								disabled={isPast || !hasSlots}
								onClick={() => setSelectedDay(date)}
								className={cn(
									"aspect-square rounded-full text-sm transition-colors",
									isPast || !hasSlots
										? "text-foreground/25"
										: "text-foreground hover:bg-primary/10",
									hasSlots &&
										!isSelected &&
										"bg-primary/10 font-medium text-primary",
									isSelected &&
										"bg-primary font-medium text-white",
								)}
							>
								{date.getDate()}
							</button>
						);
					})}
				</div>

				<div className="mt-4 flex items-center gap-2 text-foreground/60 text-xs">
					<GlobeIcon className="size-3.5" />
					{timeZone}
				</div>
			</div>

			{selectedDay && (
				<div className="flex max-h-96 w-full flex-col gap-2 overflow-y-auto border-border border-t p-6 md:w-56 md:border-t-0 md:border-l">
					<p className="mb-1 font-medium text-sm">
						{selectedDay.toLocaleDateString(undefined, {
							weekday: "short",
							month: "short",
							day: "numeric",
						})}
					</p>
					{selectedDaySlots.length === 0 && (
						<p className="text-foreground/50 text-sm">
							{t("profile.booking.noSlots")}
						</p>
					)}
					{selectedDaySlots.map((slot) => (
						<button
							key={slot.startsAt}
							type="button"
							onClick={() => {
								setSelectedSlot(slot.startsAt);
								form.setValue(
									"startsAt",
									new Date(slot.startsAt),
									{ shouldValidate: true },
								);
							}}
							className="rounded-lg border border-border px-3 py-2 text-sm hover:border-primary hover:text-primary"
						>
							{new Date(slot.startsAt).toLocaleTimeString(
								undefined,
								{
									hour: "numeric",
									minute: "2-digit",
								},
							)}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
