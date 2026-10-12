"use client";

import { UNDO_SEND_WINDOW_MS } from "@repo/api/modules/mailboxes/lib/send-with-undo-constants";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { orpcClient } from "@shared/lib/orpc-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
	ChevronDownIcon,
	ClockIcon,
	Maximize2Icon,
	Minimize2Icon,
	SendIcon,
	Trash2Icon,
	XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { plainTextToHtml } from "../lib/email-html";
import {
	scheduledEmailsQueryKey,
	useDeleteDraftMutation,
	useSaveDraftMutation,
	useSendDraftMutation,
} from "../lib/inbox-api";
import { HtmlEditor } from "./HtmlEditor";

/**
 * Builds the Gmail-style quick schedule presets relative to `now`:
 * tomorrow morning (8am), tomorrow afternoon (1pm), and next Monday (8am).
 */
function buildSchedulePresets(now: Date): Array<{ label: string; at: Date }> {
	const tomorrowMorning = new Date(now);
	tomorrowMorning.setDate(now.getDate() + 1);
	tomorrowMorning.setHours(8, 0, 0, 0);

	const tomorrowAfternoon = new Date(now);
	tomorrowAfternoon.setDate(now.getDate() + 1);
	tomorrowAfternoon.setHours(13, 0, 0, 0);

	const nextMonday = new Date(now);
	const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
	nextMonday.setDate(now.getDate() + daysUntilMonday);
	nextMonday.setHours(8, 0, 0, 0);

	return [
		{ label: "Tomorrow morning", at: tomorrowMorning },
		{ label: "Tomorrow afternoon", at: tomorrowAfternoon },
		{ label: "Monday morning", at: nextMonday },
	];
}

function formatPreset(d: Date): string {
	return d.toLocaleString([], {
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** Local datetime formatted for a `datetime-local` input value. */
function toDatetimeLocalValue(d: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface ComposeDialogProps {
	mailboxId: string;
	onClose: () => void;
	/** Existing draft to resume editing, if any. */
	initialDraftId?: string;
	defaultTo?: string;
	defaultCc?: string;
	defaultBcc?: string;
	defaultSubject?: string;
	/** Plain-text default body (e.g. a quick reply). */
	defaultBody?: string;
	/** Pre-rendered HTML body, e.g. a sanitized forwarded message block. */
	defaultBodyHtml?: string;
}

const AUTOSAVE_DELAY_MS = 1500;

export function ComposeDialog({
	mailboxId,
	onClose,
	initialDraftId,
	defaultTo = "",
	defaultCc = "",
	defaultBcc = "",
	defaultSubject = "",
	defaultBody = "",
	defaultBodyHtml,
}: ComposeDialogProps) {
	const [to, setTo] = useState(defaultTo);
	const [cc, setCc] = useState(defaultCc);
	const [bcc, setBcc] = useState(defaultBcc);
	const [subject, setSubject] = useState(defaultSubject);
	// The editor holds rendered HTML; `body` mirrors its innerHTML for sending.
	const [body, setBody] = useState(
		defaultBodyHtml ?? plainTextToHtml(defaultBody),
	);
	const initialHtml = useRef(
		defaultBodyHtml ?? plainTextToHtml(defaultBody),
	).current;
	const [showCc, setShowCc] = useState(false);
	const [showBcc, setShowBcc] = useState(false);
	const [minimized, setMinimized] = useState(false);
	const [fullscreen, setFullscreen] = useState(false);
	const [showCustomSchedule, setShowCustomSchedule] = useState(false);
	const [customScheduleAt, setCustomScheduleAt] = useState("");
	const [draftId, setDraftId] = useState<string | undefined>(initialDraftId);
	const [savedNote, setSavedNote] = useState<"saving" | "saved" | null>(null);
	const toRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	// Latest field values for save flushes that shouldn't depend on stale state.
	const latest = useRef({ to, cc, bcc, subject, body, draftId });
	latest.current = { to, cc, bcc, subject, body, draftId };
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const dirtyRef = useRef(false);
	// Skip the very first autosave triggered by mounting with prefilled values.
	const hydratedRef = useRef(false);

	const saveDraftMutation = useSaveDraftMutation(mailboxId);
	const sendDraftMutation = useSendDraftMutation(mailboxId);
	const deleteDraftMutation = useDeleteDraftMutation(mailboxId);

	// Keep the latest mutation in a ref so the autosave callback stays stable.
	const saveMutationRef = useRef(saveDraftMutation);
	saveMutationRef.current = saveDraftMutation;

	const hasContent = useCallback(() => {
		const v = latest.current;
		return Boolean(
			v.to.trim() ||
				v.cc.trim() ||
				v.bcc.trim() ||
				v.subject.trim() ||
				v.body.trim(),
		);
	}, []);

	const saveDraft = useCallback(async () => {
		if (!hasContent()) {
			return;
		}
		setSavedNote("saving");
		try {
			const v = latest.current;
			const res = await saveMutationRef.current.mutateAsync({
				draftId: v.draftId,
				to: v.to || undefined,
				cc: v.cc || undefined,
				bcc: v.bcc || undefined,
				subject: v.subject || undefined,
				body: v.body || undefined,
			});
			if (res.draftId) {
				setDraftId(res.draftId);
			}
			dirtyRef.current = false;
			setSavedNote("saved");
		} catch {
			setSavedNote(null);
		}
	}, [hasContent]);

	// Debounced autosave whenever a field changes.
	useEffect(() => {
		if (!hydratedRef.current) {
			hydratedRef.current = true;
			return;
		}
		dirtyRef.current = true;
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		debounceRef.current = setTimeout(() => {
			void saveDraft();
		}, AUTOSAVE_DELAY_MS);
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current);
			}
		};
	}, [to, cc, bcc, subject, body, saveDraft]);

	const cancelAutosave = () => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
			debounceRef.current = null;
		}
	};

	const { mutate: send, isPending } = useMutation({
		mutationFn: async () => {
			const v = latest.current;
			// Prefer sending the exact saved draft to avoid a duplicate.
			if (v.draftId) {
				// Persist the latest edits into the draft first.
				await saveDraftMutation.mutateAsync({
					draftId: v.draftId,
					to: v.to || undefined,
					cc: v.cc || undefined,
					bcc: v.bcc || undefined,
					subject: v.subject || undefined,
					body: v.body || undefined,
				});
				return sendDraftMutation.mutateAsync(v.draftId);
			}
			return orpcClient.mailboxes.inbox.sendWithUndo({
				mailboxId,
				to: v.to,
				cc: v.cc || undefined,
				bcc: v.bcc || undefined,
				subject: v.subject,
				body: v.body,
			});
		},
		onSuccess: (result) => {
			if (result && "scheduledEmailId" in result) {
				const { scheduledEmailId } = result;
				toast.success("Email sent", {
					duration: UNDO_SEND_WINDOW_MS,
					action: {
						label: "Undo",
						onClick: () => {
							orpcClient.mailboxes.inbox
								.cancelScheduled({
									mailboxId,
									id: scheduledEmailId,
								})
								.then(() => {
									toast.success("Send undone");
								})
								.catch(() => {
									toast.error(
										"Too late to undo — it already sent.",
									);
								});
						},
					},
				});
			} else {
				toast.success("Email sent");
			}
			onClose();
		},
		onError: (err) => {
			toast.error(
				err instanceof Error ? err.message : "Failed to send email",
			);
		},
	});

	const { mutate: schedule, isPending: isScheduling } = useMutation({
		mutationFn: (scheduledAt: Date) =>
			orpcClient.mailboxes.inbox.schedule({
				mailboxId,
				to,
				cc: cc || undefined,
				bcc: bcc || undefined,
				subject,
				body,
				scheduledAt: scheduledAt.toISOString(),
			}),
		onSuccess: (_data, scheduledAt) => {
			queryClient.invalidateQueries({
				queryKey: scheduledEmailsQueryKey(mailboxId),
			});
			toast.success(`Send scheduled for ${formatPreset(scheduledAt)}`);
			onClose();
		},
		onError: (err) => {
			toast.error(
				err instanceof Error ? err.message : "Failed to schedule email",
			);
		},
	});

	const validateForm = () => {
		if (!to.trim()) {
			toast.error("Please add a recipient");
			toRef.current?.focus();
			return false;
		}
		if (!subject.trim()) {
			toast.error("Please add a subject");
			return false;
		}
		// Strip tags to check for actual text/image content before sending.
		const hasContent =
			body.replace(/<[^>]*>/g, "").trim().length > 0 ||
			/<img\b/i.test(body);
		if (!hasContent) {
			toast.error("Please write a message");
			return false;
		}
		return true;
	};

	const handleSend = () => {
		if (!validateForm()) {
			return;
		}
		cancelAutosave();
		send();
	};

	const handleSchedule = (scheduledAt: Date) => {
		if (!validateForm()) {
			return;
		}
		if (scheduledAt.getTime() <= Date.now()) {
			toast.error("Pick a time in the future");
			return;
		}
		schedule(scheduledAt);
	};

	const presets = buildSchedulePresets(new Date());
	const busy = isPending || isScheduling;

	// Flush a final save when closing with unsaved content.
	const handleClose = () => {
		cancelAutosave();
		if (dirtyRef.current && hasContent()) {
			void saveDraft();
		}
		onClose();
	};

	const handleDiscard = () => {
		cancelAutosave();
		const id = latest.current.draftId;
		if (id) {
			deleteDraftMutation.mutate(id, {
				onSuccess: () => toast.success("Draft discarded"),
			});
		}
		onClose();
	};

	return (
		<div
			className={cn(
				"fixed z-[100] bg-card border border-border rounded-t-xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200",
				fullscreen
					? "inset-4 rounded-xl"
					: minimized
						? "bottom-0 right-6 w-80 h-12"
						: "bottom-0 right-6 w-[560px] h-[520px]",
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 bg-muted/60 select-none shrink-0">
				<button
					type="button"
					onClick={() => !fullscreen && setMinimized((v) => !v)}
					className="flex-1 min-w-0 text-left text-sm font-semibold text-foreground truncate cursor-pointer bg-transparent border-none p-0"
				>
					{subject || "New Message"}
				</button>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setMinimized((v) => !v);
						}}
						className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
						aria-label={minimized ? "Expand" : "Minimize"}
					>
						<ChevronDownIcon
							className={cn(
								"size-4 transition-transform",
								minimized ? "rotate-180" : "",
							)}
						/>
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setFullscreen((v) => !v);
							setMinimized(false);
						}}
						className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
						aria-label={
							fullscreen ? "Exit fullscreen" : "Fullscreen"
						}
					>
						{fullscreen ? (
							<Minimize2Icon className="size-4" />
						) : (
							<Maximize2Icon className="size-4" />
						)}
					</button>
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							handleClose();
						}}
						className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
						aria-label="Close"
					>
						<XIcon className="size-4" />
					</button>
				</div>
			</div>

			{!minimized && (
				<div className="flex flex-col flex-1 overflow-hidden">
					<div className="border-b border-border">
						<div className="flex items-center px-4 py-2 border-b border-border/50">
							<label
								htmlFor="compose-to"
								className="text-xs text-muted-foreground w-8 shrink-0"
							>
								To
							</label>
							<input
								id="compose-to"
								ref={toRef}
								type="email"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								placeholder="Recipients"
								className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
							/>
							<div className="flex gap-2 ml-2">
								{!showCc && (
									<button
										type="button"
										onClick={() => setShowCc(true)}
										className="text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										Cc
									</button>
								)}
								{!showBcc && (
									<button
										type="button"
										onClick={() => setShowBcc(true)}
										className="text-xs text-muted-foreground hover:text-foreground transition-colors"
									>
										Bcc
									</button>
								)}
							</div>
						</div>

						{showCc && (
							<div className="flex items-center px-4 py-2 border-b border-border/50">
								<label
									htmlFor="compose-cc"
									className="text-xs text-muted-foreground w-8 shrink-0"
								>
									Cc
								</label>
								<input
									id="compose-cc"
									type="email"
									value={cc}
									onChange={(e) => setCc(e.target.value)}
									placeholder="Cc recipients"
									className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
								/>
							</div>
						)}

						{showBcc && (
							<div className="flex items-center px-4 py-2 border-b border-border/50">
								<label
									htmlFor="compose-bcc"
									className="text-xs text-muted-foreground w-8 shrink-0"
								>
									Bcc
								</label>
								<input
									id="compose-bcc"
									type="email"
									value={bcc}
									onChange={(e) => setBcc(e.target.value)}
									placeholder="Bcc recipients"
									className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
								/>
							</div>
						)}

						<div className="flex items-center px-4 py-2">
							<input
								type="text"
								value={subject}
								onChange={(e) => setSubject(e.target.value)}
								placeholder="Subject"
								className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 font-medium"
							/>
						</div>
					</div>

					<HtmlEditor
						initialHtml={initialHtml}
						onChange={setBody}
						placeholder="Write your message..."
						className="bg-transparent text-foreground"
					/>

					<div className="flex items-center justify-between px-3 py-2.5 border-t border-border shrink-0">
						<div className="flex items-center gap-3">
							{/* Send */}
							<Button
								onClick={handleSend}
								disabled={busy}
								size="sm"
								className="gap-2 rounded-r-none px-5"
							>
								<SendIcon className="size-3.5" />
								{isPending ? "Sending…" : "Send"}
							</Button>
							{/* Schedule send */}
							<DropdownMenu
								onOpenChange={(open) => {
									if (!open) {
										setShowCustomSchedule(false);
									}
								}}
							>
								<DropdownMenuTrigger asChild>
									<Button
										size="sm"
										disabled={busy}
										aria-label="Schedule send"
										className="rounded-l-none border-l border-primary-foreground/20 px-2"
									>
										<ChevronDownIcon className="size-3.5" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="start"
									side="top"
									className="z-[110] w-60"
								>
									<div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
										Schedule send
									</div>
									{presets.map((preset) => (
										<DropdownMenuItem
											key={preset.label}
											onSelect={() =>
												handleSchedule(preset.at)
											}
											className="flex items-center justify-between gap-3"
										>
											<span>{preset.label}</span>
											<span className="text-xs text-muted-foreground">
												{formatPreset(preset.at)}
											</span>
										</DropdownMenuItem>
									))}
									<DropdownMenuItem
										onSelect={(e) => {
											// Keep the menu open to reveal the picker.
											e.preventDefault();
											setShowCustomSchedule(true);
										}}
									>
										<ClockIcon className="mr-2 size-3.5" />
										Pick date & time
									</DropdownMenuItem>
									{showCustomSchedule && (
										<div className="flex flex-col gap-2 px-2 py-2">
											<input
												type="datetime-local"
												aria-label="Schedule date and time"
												value={customScheduleAt}
												min={toDatetimeLocalValue(
													new Date(),
												)}
												onChange={(e) =>
													setCustomScheduleAt(
														e.target.value,
													)
												}
												className="w-full rounded border border-border bg-background px-2 py-1 text-sm outline-none"
											/>
											<Button
												size="sm"
												disabled={
													busy || !customScheduleAt
												}
												onClick={() =>
													handleSchedule(
														new Date(
															customScheduleAt,
														),
													)
												}
											>
												Schedule
											</Button>
										</div>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
							{savedNote && (
								<span className="text-xs text-muted-foreground">
									{savedNote === "saving"
										? "Saving…"
										: "Draft saved"}
								</span>
							)}
						</div>
						<button
							type="button"
							onClick={handleDiscard}
							className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"
							aria-label="Discard draft"
						>
							<Trash2Icon className="size-4" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
