"use client";

import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { useCalendarEventsQuery } from "@saas/mailboxes/lib/rules-api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import {
	CalendarIcon,
	ChevronLeftIcon,
	ChevronRightIcon,
	ClockIcon,
	MapPinIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

function formatTime(isoString: string): string {
	const d = new Date(isoString);
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

interface CalendarEvent {
	id: string;
	summary: string | null;
	start: string | null;
	end: string | null;
	location: string | null;
	isAllDay: boolean;
}

function eventTone(isAllDay: boolean) {
	return isAllDay
		? "border-foreground/20 bg-foreground text-background"
		: "border-border bg-muted/60 text-foreground";
}

export function CalendarPage() {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	const todayRef = useMemo(() => new Date(), []);
	const [currentYear, setCurrentYear] = useState(todayRef.getFullYear());
	const [currentMonth, setCurrentMonth] = useState(todayRef.getMonth());
	const [selectedDay, setSelectedDay] = useState<Date>(todayRef);

	const { selectedMailboxId } = useSelectedMailbox();
	const { data: mailboxes = [], isLoading: mailboxesLoading } =
		useMailboxesQuery();

	const { timeMin, timeMax, gridStart } = useMemo(() => {
		const firstOfMonth = new Date(currentYear, currentMonth, 1);
		const gridStartDate = new Date(firstOfMonth);
		gridStartDate.setDate(gridStartDate.getDate() - gridStartDate.getDay());
		const gridEndDate = new Date(gridStartDate);
		gridEndDate.setDate(gridEndDate.getDate() + 41);
		gridEndDate.setHours(23, 59, 59, 999);
		return {
			timeMin: gridStartDate.toISOString(),
			timeMax: gridEndDate.toISOString(),
			gridStart: gridStartDate,
		};
	}, [currentYear, currentMonth]);

	const { data: calendarData, isLoading: calendarLoading } =
		useCalendarEventsQuery(selectedMailboxId, { timeMin, timeMax });

	const needsReconnect = !calendarLoading && !!calendarData?.needsReconnect;
	const serviceDisabled = !calendarLoading && !!calendarData?.serviceDisabled;
	const calendarError = calendarLoading
		? null
		: (calendarData?.calendarError ?? null);

	const events = useMemo((): CalendarEvent[] => {
		if (!calendarData || needsReconnect || serviceDisabled) {
			return [];
		}
		return calendarData.events;
	}, [calendarData]);

	const calendarDays = useMemo(() => {
		return Array.from({ length: 42 }, (_, i) => {
			const date = new Date(gridStart);
			date.setDate(date.getDate() + i);
			return {
				date,
				isCurrentMonth: date.getMonth() === currentMonth,
				isToday: isSameDay(date, todayRef),
				dayEvents: events.filter(
					(ev) => ev.start && isSameDay(new Date(ev.start), date),
				),
			};
		});
	}, [gridStart, currentMonth, events, todayRef]);

	const selectedDayEvents = useMemo(
		() =>
			events.filter(
				(ev) => ev.start && isSameDay(new Date(ev.start), selectedDay),
			),
		[events, selectedDay],
	);

	const prevMonth = () => {
		if (currentMonth === 0) {
			setCurrentMonth(11);
			setCurrentYear((y) => y - 1);
		} else {
			setCurrentMonth((m) => m - 1);
		}
	};
	const nextMonth = () => {
		if (currentMonth === 11) {
			setCurrentMonth(0);
			setCurrentYear((y) => y + 1);
		} else {
			setCurrentMonth((m) => m + 1);
		}
	};
	const goToToday = () => {
		setCurrentMonth(todayRef.getMonth());
		setCurrentYear(todayRef.getFullYear());
		setSelectedDay(todayRef);
	};

	const handleReconnect = () => {
		const callbackURL = new URL(
			authConfig.mailboxes.defaultCallbackPath,
			window.location.origin,
		).toString();
		authClient.linkSocial({ provider: "google", callbackURL });
	};

	if (!mailboxesLoading && mailboxes.length === 0) {
		return (
			<div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
				<CalendarIcon className="size-12 text-foreground/30" />
				<h2 className="font-serif text-2xl font-normal">
					No mailbox connected
				</h2>
				<p className="text-sm text-foreground/60">
					Connect a mailbox to see your calendar.
				</p>
			</div>
		);
	}

	return (
		<div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6">
			<div className="flex items-end justify-between gap-4 rounded-[2rem] border border-border bg-card px-6 py-6 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.24)]">
				<div className="space-y-2">
					<p className="font-mono text-[11px] uppercase tracking-[0.35em] text-foreground/45">
						Calendar
					</p>
					<h1 className="text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
						{mounted
							? `${MONTHS[currentMonth]} ${currentYear}`
							: ""}
					</h1>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={goToToday}
						className="rounded-full"
					>
						Today
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={prevMonth}
						className="rounded-full border border-border bg-background"
					>
						<ChevronLeftIcon className="size-4" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						onClick={nextMonth}
						className="rounded-full border border-border bg-background"
					>
						<ChevronRightIcon className="size-4" />
					</Button>
				</div>
			</div>

			{serviceDisabled && (
				<div className="mb-4 flex items-center gap-4 rounded-xl border border-border bg-muted px-4 py-3">
					<CalendarIcon className="size-4 shrink-0 text-foreground" />
					<p className="text-sm text-foreground">
						<span className="font-medium">
							Google Calendar API is disabled.
						</span>{" "}
						Enable it in the Google Cloud Console for this project.
					</p>
				</div>
			)}
			{calendarError && (
				<div className="mb-4 flex items-center gap-4 rounded-xl border border-border bg-muted px-4 py-3">
					<CalendarIcon className="size-4 shrink-0 text-foreground" />
					<p className="text-sm text-foreground">
						<span className="font-medium">
							Couldn't load your calendar.
						</span>{" "}
						{calendarError}
					</p>
				</div>
			)}
			{needsReconnect && (
				<div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-muted px-4 py-3">
					<div className="flex items-center gap-3">
						<CalendarIcon className="size-4 shrink-0 text-foreground" />
						<p className="text-sm text-foreground">
							<span className="font-medium">
								Calendar access needed.
							</span>{" "}
							Reconnect your Google account to see events.
						</p>
					</div>
					<Button
						size="sm"
						variant="outline"
						onClick={handleReconnect}
						className="shrink-0 gap-1.5"
					>
						<RefreshCwIcon className="size-3.5" />
						Reconnect
					</Button>
				</div>
			)}

			<div className="flex flex-1 gap-5">
				<div className="flex-1 overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_18px_50px_-32px_rgba(0,0,0,0.24)]">
					<div className="grid grid-cols-7 border-b border-border">
						{DAYS.map((day) => (
							<div
								key={day}
								className="py-2 text-center font-mono text-xs uppercase tracking-wider text-foreground/40"
							>
								{day}
							</div>
						))}
					</div>

					{calendarLoading ? (
						<div className="grid grid-cols-7">
							{Array.from({ length: 42 }).map((_, i) => (
								<div
									key={i}
									className="min-h-[108px] border-b border-r border-border/40 p-3"
								>
									<Skeleton className="mb-2 h-5 w-6" />
									<Skeleton className="h-4 w-full" />
								</div>
							))}
						</div>
					) : (
						<div className="grid grid-cols-7">
							{calendarDays.map(
								(
									{
										date,
										isCurrentMonth,
										isToday,
										dayEvents,
									},
									i,
								) => {
									const isSelected = isSameDay(
										date,
										selectedDay,
									);
									const isLastCol = (i + 1) % 7 === 0;
									const isLastRow =
										Math.floor(i / 7) ===
										Math.ceil(calendarDays.length / 7) - 1;

									return (
										<button
											key={i}
											type="button"
											onClick={() =>
												setSelectedDay(new Date(date))
											}
											className={[
												"min-h-[108px] cursor-pointer p-3 text-left transition-colors hover:bg-muted/30",
												!isLastCol
													? "border-r border-border/40"
													: "",
												!isLastRow
													? "border-b border-border/40"
													: "",
												isSelected
													? "bg-foreground/[0.035] ring-1 ring-inset ring-foreground/10"
													: "",
											].join(" ")}
										>
											<span
												className={[
													"inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
													isToday
														? "bg-foreground text-background"
														: "",
													!isToday && isCurrentMonth
														? "text-foreground"
														: "",
													!isToday && !isCurrentMonth
														? "text-foreground/25"
														: "",
												].join(" ")}
											>
												{date.getDate()}
											</span>
											<div className="mt-1 space-y-0.5">
												{dayEvents
													.slice(0, 3)
													.map((ev) => (
														<div
															key={ev.id}
															className={`truncate rounded-full border px-2 py-1 text-[10px] font-medium leading-tight ${eventTone(ev.isAllDay)}`}
														>
															{!ev.isAllDay &&
																ev.start && (
																	<span className="mr-1 opacity-60">
																		{formatTime(
																			ev.start,
																		)}
																	</span>
																)}
															{ev.summary ??
																"Untitled"}
														</div>
													))}
												{dayEvents.length > 3 && (
													<p className="pl-1 text-[10px] text-foreground/40">
														+{dayEvents.length - 3}{" "}
														more
													</p>
												)}
											</div>
										</button>
									);
								},
							)}
						</div>
					)}
				</div>

				<div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_18px_50px_-32px_rgba(0,0,0,0.24)]">
					<div className="border-b border-border px-5 py-4">
						<p className="font-serif text-2xl font-normal leading-none text-foreground">
							{mounted
								? selectedDay.toLocaleDateString([], {
										weekday: "long",
										month: "long",
										day: "numeric",
									})
								: ""}
						</p>
						{!needsReconnect && (
							<p className="mt-2 font-mono text-[11px] uppercase tracking-[0.26em] text-foreground/45">
								{selectedDayEvents.length === 0
									? "No events"
									: `${selectedDayEvents.length} event${selectedDayEvents.length > 1 ? "s" : ""}`}
							</p>
						)}
					</div>

					{calendarLoading ? (
						<div className="space-y-3 p-4">
							<Skeleton className="h-16 w-full" />
							<Skeleton className="h-16 w-full" />
						</div>
					) : needsReconnect ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
							<CalendarIcon className="size-8 text-foreground/20" />
							<p className="text-xs text-foreground/50">
								Reconnect to see events
							</p>
						</div>
					) : selectedDayEvents.length === 0 ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
							<CalendarIcon className="size-6 text-foreground/20" />
							<p className="text-xs text-foreground/50">
								Nothing scheduled
							</p>
						</div>
					) : (
						<div className="flex-1 divide-y divide-border overflow-y-auto">
							{selectedDayEvents.map((ev) => (
								<div key={ev.id} className="p-5">
									<div
										className={`mb-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] ${eventTone(ev.isAllDay)}`}
									>
										{ev.isAllDay
											? "All day"
											: ev.start
												? formatTime(ev.start)
												: ""}
									</div>
									<p className="text-sm font-medium leading-snug text-foreground">
										{ev.summary ?? "Untitled event"}
									</p>
									{ev.start && !ev.isAllDay && (
										<div className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground/50">
											<ClockIcon className="size-3 shrink-0" />
											<span>
												{formatTime(ev.start)}
												{ev.end
													? ` – ${formatTime(ev.end)}`
													: ""}
											</span>
										</div>
									)}
									{ev.location && (
										<div className="mt-1 flex items-center gap-1.5 text-xs text-foreground/50">
											<MapPinIcon className="size-3 shrink-0" />
											<span className="truncate">
												{ev.location}
											</span>
										</div>
									)}
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
