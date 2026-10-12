"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import {
	formatElapsed,
	useVoiceRecording,
} from "@shared/hooks/use-voice-recording";
import { orpcClient } from "@shared/lib/orpc-client";
import type { UIMessage } from "ai";
import { lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import {
	ArrowLeftIcon,
	Loader2Icon,
	MicIcon,
	SendIcon,
	SparklesIcon,
	SquareIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ActionConfirmationCard } from "./ActionConfirmationCard";
import { EmailCitationCard } from "./EmailCitationCard";
import { Markdown } from "./Markdown";

/** Tool names that require an inline confirm/cancel card before executing. */
const GATED_TOOL_NAMES = new Set([
	"sendEmail",
	"sendSavedDraft",
	"scheduleEmail",
	"deleteEmail",
	"trashEmail",
	"createMeeting",
	"createCalendarEvent",
]);

const SUGGESTIONS = [
	"Summarize what came in today.",
	"Any clients I haven't replied to?",
	"What did LinkedIn send me this week?",
	"What rules do I have active right now?",
];

interface ChatViewProps {
	mailboxId: string;
	conversationId: string;
	initialMessages: UIMessage[];
	onBack: () => void;
	/** Called when the user sends the first message (to auto-title the thread). */
	onFirstMessage?: (text: string) => void;
	/** Close the whole widget (used when a citation navigates away). */
	onNavigateAway?: () => void;
	/** Pre-fills the composer, e.g. with a transcript from the voice input overlay. */
	initialInput?: string;
}

export function ChatView({
	mailboxId,
	conversationId,
	initialMessages,
	onBack,
	onFirstMessage,
	onNavigateAway,
	initialInput,
}: ChatViewProps) {
	const [input, setInput] = useState(initialInput ?? "");
	const messagesContainerRef = useRef<HTMLDivElement>(null);
	const firstSentRef = useRef(initialMessages.length > 0);

	const { recordingState, elapsedSeconds, startRecording, stopRecording } =
		useVoiceRecording((text) => {
			setInput((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
		});

	const { messages, status, sendMessage, addToolApprovalResponse } = useChat({
		id: conversationId,
		messages: initialMessages,
		// Once every approval in the last assistant message has a response,
		// automatically resubmit so the server can execute approved tools and
		// continue the same conversational turn.
		sendAutomaticallyWhen:
			lastAssistantMessageIsCompleteWithApprovalResponses,
		onError: (error) => {
			toast.error(error.message ?? "Something went wrong");
		},
		transport: {
			async sendMessages(options) {
				return eventIteratorToStream(
					await orpcClient.ai.inboxAssistant(
						{
							mailboxId,
							conversationId,
							messages: options.messages,
							timeZone:
								Intl.DateTimeFormat().resolvedOptions()
									.timeZone,
						},
						{ signal: options.abortSignal },
					),
				);
			},
			reconnectToStream() {
				throw new Error("Unsupported");
			},
		},
	});

	useEffect(() => {
		if (messagesContainerRef.current) {
			messagesContainerRef.current.scrollTop =
				messagesContainerRef.current.scrollHeight;
		}
	}, [messages.length, status]);

	const submit = async (raw: string) => {
		const text = raw.trim();
		if (!text || status === "streaming" || status === "submitted") {
			return;
		}
		setInput("");
		if (!firstSentRef.current) {
			firstSentRef.current = true;
			onFirstMessage?.(text);
		}
		await sendMessage({ text });
	};

	const isEmpty = messages.length === 0;
	const isBusy = status === "streaming" || status === "submitted";

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Header */}
			<div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={onBack}
					aria-label="Back to conversations"
				>
					<ArrowLeftIcon className="size-4" />
				</Button>
				<div className="flex items-center gap-2">
					<span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
						<SparklesIcon className="size-3.5" />
					</span>
					<span className="text-sm font-medium">Inbox assistant</span>
				</div>
			</div>

			{/* Messages */}
			<div
				ref={messagesContainerRef}
				className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-4"
			>
				{isEmpty && (
					<div className="flex flex-1 flex-col items-center justify-center gap-4 px-2 text-center">
						<span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
							<SparklesIcon className="size-6" />
						</span>
						<div>
							<p className="text-sm font-medium text-foreground">
								Ask about your inbox
							</p>
							<p className="mt-1 text-xs text-muted-foreground">
								I read your real emails, rules and calendar to
								answer.
							</p>
						</div>
						<div className="flex w-full flex-col gap-2">
							{SUGGESTIONS.map((s) => (
								<button
									key={s}
									type="button"
									onClick={() => submit(s)}
									className="rounded-xl border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-accent"
								>
									{s}
								</button>
							))}
						</div>
					</div>
				)}

				{messages.map((message) => (
					<div
						key={message.id}
						className={cn(
							"flex flex-col gap-2",
							message.role === "user"
								? "items-end"
								: "items-start",
						)}
					>
						{message.parts?.map((part, partIndex) => {
							if (part.type === "text") {
								return message.role === "user" ? (
									<div
										key={partIndex}
										className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
									>
										{part.text}
									</div>
								) : (
									<div
										key={partIndex}
										className="max-w-[90%] rounded-2xl rounded-bl-sm bg-muted px-3.5 py-2 text-foreground"
									>
										<Markdown>{part.text}</Markdown>
									</div>
								);
							}

							if (
								part.type.startsWith("tool-") &&
								GATED_TOOL_NAMES.has(
									part.type.slice("tool-".length),
								)
							) {
								const toolPart = part as unknown as {
									type: string;
									state: string;
									input?: Record<string, unknown>;
									output?: unknown;
									errorText?: string;
									approval?: {
										id: string;
										approved?: boolean;
										reason?: string;
									};
								};
								const toolName = toolPart.type.slice(
									"tool-".length,
								);
								return (
									<ActionConfirmationCard
										key={partIndex}
										toolName={toolName}
										state={toolPart.state}
										input={toolPart.input ?? {}}
										output={toolPart.output}
										errorText={toolPart.errorText}
										approved={toolPart.approval?.approved}
										onRespond={(approved) => {
											if (!toolPart.approval?.id) {
												return;
											}
											addToolApprovalResponse({
												id: toolPart.approval.id,
												approved,
												reason: approved
													? undefined
													: "User declined",
											});
										}}
									/>
								);
							}

							if (part.type === "tool-citeEmails") {
								const toolPart = part as unknown as {
									type: "tool-citeEmails";
									input?: { emailIds?: string[] };
								};
								const ids = toolPart.input?.emailIds ?? [];
								if (ids.length === 0) {
									return null;
								}
								return (
									<div
										key={partIndex}
										className="flex w-full max-w-[90%] flex-col gap-1.5"
									>
										<span className="px-1 text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
											Sources
										</span>
										{ids.map((id) => (
											<EmailCitationCard
												key={id}
												mailboxId={mailboxId}
												emailId={id}
												onNavigate={onNavigateAway}
											/>
										))}
									</div>
								);
							}

							return null;
						})}
					</div>
				))}

				{isBusy && (
					<div className="flex items-start">
						<div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-muted px-3.5 py-3">
							<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
							<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
							<span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
						</div>
					</div>
				)}
			</div>

			{/* Composer */}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					submit(input);
				}}
				className="shrink-0 border-t border-border p-3"
			>
				<div className="relative rounded-2xl border border-border bg-card focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30">
					{recordingState !== "idle" && (
						<div className="-top-7 absolute left-3 flex items-center gap-1.5 text-muted-foreground text-xs">
							{recordingState === "recording" && (
								<>
									<span className="size-2 animate-pulse rounded-full bg-destructive" />
									<span>{formatElapsed(elapsedSeconds)}</span>
								</>
							)}
							{recordingState === "transcribing" && (
								<span>Transcribing…</span>
							)}
						</div>
					)}
					<Textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						disabled={isBusy || recordingState !== "idle"}
						placeholder="Ask about your inbox…"
						rows={1}
						className="max-h-40 min-h-11 resize-none rounded-2xl border-0 bg-transparent px-4 py-3 pr-20 shadow-none focus-visible:ring-0"
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								submit(input);
							}
						}}
					/>
					<Button
						type="button"
						size="icon"
						variant={
							recordingState === "recording"
								? "destructive"
								: "ghost"
						}
						className="absolute bottom-2 right-11 size-8 rounded-full"
						disabled={isBusy || recordingState === "transcribing"}
						aria-label={
							recordingState === "recording"
								? "Stop recording"
								: "Record voice message"
						}
						onClick={
							recordingState === "recording"
								? stopRecording
								: startRecording
						}
					>
						{recordingState === "transcribing" ? (
							<Loader2Icon className="size-4 animate-spin" />
						) : recordingState === "recording" ? (
							<SquareIcon className="size-4" />
						) : (
							<MicIcon className="size-4" />
						)}
					</Button>
					<Button
						type="submit"
						size="icon"
						className="absolute bottom-2 right-2 size-8 rounded-full"
						disabled={
							isBusy || !input.trim() || recordingState !== "idle"
						}
						aria-label="Send"
					>
						<SendIcon className="size-4" />
					</Button>
				</div>
			</form>
		</div>
	);
}
