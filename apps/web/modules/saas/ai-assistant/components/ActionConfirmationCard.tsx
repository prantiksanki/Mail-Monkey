"use client";

import { Button } from "@repo/ui/components/button";
import {
	CalendarIcon,
	CheckIcon,
	Loader2Icon,
	SendIcon,
	Trash2Icon,
	VideoIcon,
	XIcon,
} from "lucide-react";

type ToolInput = Record<string, unknown>;

/** Formats a plain YYYY-MM-DD (all-day event date) without a time component. */
function formatDateOnly(dateStr: unknown): string {
	if (typeof dateStr !== "string") {
		return "";
	}
	// Parse as local calendar date, not UTC midnight — new Date("2026-07-16")
	// parses as UTC and can render as the previous day in a negative-offset zone.
	const [y, m, d] = dateStr.split("-").map(Number);
	if (!y || !m || !d) {
		return dateStr;
	}
	return new Date(y, m - 1, d).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

function formatDateTime(iso: unknown): string {
	if (typeof iso !== "string") {
		return "";
	}
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) {
		return iso;
	}
	return d.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function summarize(toolName: string, input: ToolInput): string {
	switch (toolName) {
		case "sendEmail":
			return `Send to ${input.to}: "${input.subject ?? ""}"`;
		case "sendSavedDraft":
			return "Send this saved draft";
		case "scheduleEmail":
			return `Send to ${input.to} at ${formatDateTime(input.scheduledAt)}: "${input.subject ?? ""}"`;
		case "deleteEmail":
			return "Permanently delete this email";
		case "trashEmail":
			return "Move this email to trash";
		case "createMeeting": {
			const attendees = Array.isArray(input.attendees)
				? (input.attendees as string[]).join(", ")
				: undefined;
			return `${input.summary ?? "Meeting"} — ${formatDateTime(input.startIso)} to ${formatDateTime(input.endIso)}${attendees ? ` · Invites: ${attendees}` : ""}`;
		}
		case "createCalendarEvent": {
			const attendees = Array.isArray(input.attendees)
				? (input.attendees as string[]).join(", ")
				: undefined;
			const when = input.allDay
				? `All day, ${formatDateOnly(input.startDate)}`
				: `${formatDateTime(input.startIso)} to ${formatDateTime(input.endIso)}`;
			return `${input.summary ?? "Event"} — ${when}${attendees ? ` · Invites: ${attendees}` : ""}`;
		}
		default:
			return "Confirm this action";
	}
}

/**
 * Some gated tools (createMeeting, createCalendarEvent) never throw — they
 * catch provider errors internally and return a status-union result like
 * { status: "needsReconnect" }. The AI SDK still marks that as a completed
 * `output-available` tool call, so the card must inspect the payload itself
 * rather than assuming output-available always means success.
 */
function outcomeFor(
	output: unknown,
): { ok: true } | { ok: false; message: string } {
	if (!output || typeof output !== "object" || !("status" in output)) {
		return { ok: true };
	}
	const status = (output as { status: unknown }).status;
	if (status === "ok") {
		return { ok: true };
	}
	if (status === "needsReconnect") {
		return {
			ok: false,
			message:
				(output as { message?: string }).message ||
				"Calendar access isn't granted. Reconnect your Google account in Settings.",
		};
	}
	if (status === "serviceDisabled") {
		return {
			ok: false,
			message: "The Google Calendar API is temporarily disabled.",
		};
	}
	if (status === "error") {
		return {
			ok: false,
			message:
				(output as { message?: string }).message ||
				"This action failed.",
		};
	}
	return { ok: true };
}

function iconFor(toolName: string) {
	switch (toolName) {
		case "sendEmail":
		case "sendSavedDraft":
		case "scheduleEmail":
			return SendIcon;
		case "deleteEmail":
		case "trashEmail":
			return Trash2Icon;
		case "createMeeting":
			return VideoIcon;
		case "createCalendarEvent":
			return CalendarIcon;
		default:
			return SendIcon;
	}
}

/**
 * Inline confirm/cancel card for a risky (needsApproval) inbox-assistant tool
 * call. Renders one of three states based on the AI SDK's tool part state:
 * pending confirmation, in-flight (auto-resubmitting), or a completed/denied
 * outcome — mirrors the same part reactively, no local state machine needed.
 */
export function ActionConfirmationCard({
	toolName,
	state,
	input,
	output,
	errorText,
	approved,
	onRespond,
}: {
	toolName: string;
	state: string;
	input: ToolInput;
	output?: unknown;
	errorText?: string;
	approved?: boolean;
	onRespond: (approved: boolean) => void;
}) {
	const Icon = iconFor(toolName);
	const summary = summarize(toolName, input);

	if (state === "approval-requested") {
		return (
			<div className="flex w-full max-w-[90%] flex-col gap-2 rounded-xl border border-primary/30 bg-primary-soft/60 p-3">
				<div className="flex items-start gap-2">
					<span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
						<Icon className="size-3.5" />
					</span>
					<p className="min-w-0 flex-1 text-xs text-foreground">
						{summary}
					</p>
				</div>
				<div className="flex justify-end gap-2">
					<Button
						size="sm"
						variant="outline"
						onClick={() => onRespond(false)}
					>
						Cancel
					</Button>
					<Button size="sm" onClick={() => onRespond(true)}>
						Confirm
					</Button>
				</div>
			</div>
		);
	}

	if (state === "approval-responded") {
		return (
			<div className="flex w-full max-w-[90%] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
				<Loader2Icon className="size-3.5 shrink-0 animate-spin" />
				{approved ? "Confirming…" : "Cancelling…"}
			</div>
		);
	}

	if (state === "output-denied") {
		return (
			<div className="flex w-full max-w-[90%] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
				<XIcon className="size-3.5 shrink-0" />
				Cancelled — nothing was done.
			</div>
		);
	}

	if (state === "output-error") {
		return (
			<div className="flex w-full max-w-[90%] items-center gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
				<XIcon className="size-3.5 shrink-0" />
				{errorText || "This action failed."}
			</div>
		);
	}

	if (state === "output-available") {
		const outcome = outcomeFor(output);
		if (!outcome.ok) {
			return (
				<div className="flex w-full max-w-[90%] items-center gap-2 rounded-xl border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
					<XIcon className="size-3.5 shrink-0" />
					{outcome.message}
				</div>
			);
		}
		return (
			<div className="flex w-full max-w-[90%] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground">
				<CheckIcon className="size-3.5 shrink-0 text-primary" />
				{summary} — done.
			</div>
		);
	}

	return null;
}
