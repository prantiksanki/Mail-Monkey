import { db } from "../client";

export interface WeeklyAvailabilityInput {
	dayOfWeek: number; // 0 (Sunday) .. 6 (Saturday)
	startTime: string; // "HH:mm"
	endTime: string; // "HH:mm"
}

/** Replaces a creator's entire weekly schedule with the given windows. */
export async function replaceWeeklyAvailability(
	creatorProfileId: string,
	windows: WeeklyAvailabilityInput[],
) {
	return db.$transaction([
		db.weeklyAvailability.deleteMany({ where: { creatorProfileId } }),
		db.weeklyAvailability.createMany({
			data: windows.map((w) => ({ ...w, creatorProfileId })),
		}),
	]);
}

export async function getWeeklyAvailability(creatorProfileId: string) {
	return db.weeklyAvailability.findMany({
		where: { creatorProfileId },
		orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
	});
}

/** Bookings holding a slot (confirmed or awaiting host review) overlapping [from, to). */
export async function getBookingsInRange(
	creatorProfileId: string,
	from: Date,
	to: Date,
) {
	return db.booking.findMany({
		where: {
			creatorProfileId,
			status: { in: ["PENDING", "ACCEPTING", "CONFIRMED"] },
			startsAt: { lt: to },
			endsAt: { gt: from },
		},
		orderBy: { startsAt: "asc" },
	});
}

export interface CreateBookingInput {
	creatorProfileId: string;
	visitorName: string;
	visitorEmail: string;
	note?: string;
	startsAt: Date;
	endsAt: Date;
	cancelToken: string;
	paid?: boolean;
	checkoutId?: string;
}

/**
 * Creates a booking (as PENDING, awaiting host review) iff no PENDING/
 * ACCEPTING/CONFIRMED booking on the same profile overlaps the requested
 * window. Runs inside a serializable transaction so two visitors racing for
 * the same slot can't both win it.
 */
export async function createBookingIfFree(input: CreateBookingInput) {
	return db.$transaction(
		async (tx) => {
			const conflict = await tx.booking.findFirst({
				where: {
					creatorProfileId: input.creatorProfileId,
					status: { in: ["PENDING", "ACCEPTING", "CONFIRMED"] },
					startsAt: { lt: input.endsAt },
					endsAt: { gt: input.startsAt },
				},
			});

			if (conflict) {
				return null;
			}

			return tx.booking.create({
				data: { ...input, status: "PENDING" },
			});
		},
		{ isolationLevel: "Serializable" },
	);
}

export async function getBookingByCancelToken(cancelToken: string) {
	return db.booking.findUnique({ where: { cancelToken } });
}

/** Used to make webhook-driven booking creation idempotent against redelivery. */
export async function getBookingByCheckoutId(checkoutId: string) {
	return db.booking.findUnique({ where: { checkoutId } });
}

export async function getBookingById(id: string) {
	return db.booking.findUnique({
		where: { id },
		include: { creatorProfile: { include: { user: true } } },
	});
}

/** Visitor-initiated cancel — allowed while a request is pending or already confirmed. */
export async function cancelBooking(cancelToken: string) {
	const result = await db.booking.updateMany({
		where: { cancelToken, status: { in: ["PENDING", "CONFIRMED"] } },
		data: { status: "CANCELED" },
	});
	return result.count > 0;
}

/**
 * Atomically claims a PENDING booking for the accept workflow. Returns false
 * if another request already claimed it (or it's no longer pending) — the
 * caller should treat that as "already being processed" rather than retry
 * the whole workflow from scratch.
 */
export async function beginAcceptingBooking(id: string) {
	const result = await db.booking.updateMany({
		where: { id, status: "PENDING" },
		data: { status: "ACCEPTING" },
	});
	return result.count > 0;
}

/**
 * Drops a booking back to PENDING after an accept attempt failed before any
 * Meet/Calendar event was created — nothing to resume, so it's safe (and
 * least surprising to the host) to let a fresh Accept click start over.
 */
export async function revertBookingToPending(id: string, acceptError: string) {
	await db.booking.updateMany({
		where: { id, status: "ACCEPTING" },
		data: { status: "PENDING", acceptError },
	});
}

/** Partial update between accept-workflow steps, so a retry can resume. */
export async function patchBookingAcceptState(
	id: string,
	data: Partial<{
		meetLink: string;
		calendarEventId: string;
		confirmationEmailStatus: "PENDING" | "SENT" | "FAILED";
		confirmationEmailSentAt: Date;
		acceptError: string | null;
	}>,
) {
	await db.booking.update({ where: { id }, data });
}

/** Finalizes a successful accept workflow. */
export async function markBookingConfirmed(
	id: string,
	data: { meetLink: string; calendarEventId: string },
) {
	const existing = await db.booking.findUnique({
		where: { id },
		select: { acceptedAt: true },
	});
	await db.booking.update({
		where: { id },
		data: {
			...data,
			status: "CONFIRMED",
			acceptedAt: existing?.acceptedAt ?? new Date(),
			acceptError: null,
		},
	});
}

export async function declineBooking(id: string) {
	const result = await db.booking.updateMany({
		where: { id, status: "PENDING" },
		data: { status: "DECLINED", declinedAt: new Date() },
	});
	return result.count > 0;
}

/** Upcoming bookings for the creator's own dashboard — pending, mid-accept, or confirmed — soonest first. */
export async function getUpcomingBookings(creatorProfileId: string) {
	return db.booking.findMany({
		where: {
			creatorProfileId,
			status: { in: ["PENDING", "ACCEPTING", "CONFIRMED"] },
			startsAt: { gte: new Date() },
		},
		orderBy: { startsAt: "asc" },
	});
}
