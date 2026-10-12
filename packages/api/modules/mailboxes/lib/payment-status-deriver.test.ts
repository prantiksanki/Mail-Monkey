import { describe, expect, it } from "vitest";
import { deriveKanbanStatus } from "./payment-status-deriver";

const NOW = new Date("2026-08-21T12:00:00Z");

function daysFromNow(days: number): Date {
	const d = new Date(NOW);
	d.setDate(d.getDate() + days);
	return d;
}

describe("deriveKanbanStatus", () => {
	it("returns UPCOMING when the due date is more than 3 days away", () => {
		expect(
			deriveKanbanStatus({
				dueDate: daysFromNow(4),
				paymentStatus: "unpaid",
				now: NOW,
			}),
		).toBe("UPCOMING");
	});

	it("returns DUE_SOON when the due date is exactly 3 days away", () => {
		expect(
			deriveKanbanStatus({
				dueDate: daysFromNow(3),
				paymentStatus: "unpaid",
				now: NOW,
			}),
		).toBe("DUE_SOON");
	});

	it("returns DUE_SOON when the due date is today", () => {
		expect(
			deriveKanbanStatus({
				dueDate: daysFromNow(0),
				paymentStatus: "unpaid",
				now: NOW,
			}),
		).toBe("DUE_SOON");
	});

	it("returns OVERDUE when the due date is yesterday", () => {
		expect(
			deriveKanbanStatus({
				dueDate: daysFromNow(-1),
				paymentStatus: "unpaid",
				now: NOW,
			}),
		).toBe("OVERDUE");
	});

	it("returns UPCOMING when there is no due date", () => {
		expect(
			deriveKanbanStatus({
				dueDate: null,
				paymentStatus: "unknown",
				now: NOW,
			}),
		).toBe("UPCOMING");
	});

	it("returns PAID when paymentStatus is paid, even with a past due date", () => {
		expect(
			deriveKanbanStatus({
				dueDate: daysFromNow(-10),
				paymentStatus: "paid",
				now: NOW,
			}),
		).toBe("PAID");
	});

	it("returns PAID when paymentStatus is paid and there is no due date", () => {
		expect(
			deriveKanbanStatus({
				dueDate: null,
				paymentStatus: "paid",
				now: NOW,
			}),
		).toBe("PAID");
	});
});
