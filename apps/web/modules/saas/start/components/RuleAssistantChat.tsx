"use client";

import { useChat } from "@ai-sdk/react";
import { eventIteratorToStream } from "@orpc/client";
import type { RuleProposal } from "@repo/api/modules/ai/procedures/rules-assistant";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Textarea } from "@repo/ui/components/textarea";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { orpcClient } from "@shared/lib/orpc-client";
import { lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { EllipsisIcon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RuleConfirmationCard } from "./RuleConfirmationCard";

export function RuleAssistantChat() {
	const { selectedMailboxId } = useSelectedMailbox();

	// Keep a mutable ref so the stable transport closure always reads the
	// current mailboxId even though the Chat instance is only created once.
	const mailboxIdRef = useRef(selectedMailboxId);
	mailboxIdRef.current = selectedMailboxId;

	const [input, setInput] = useState("");
	const messagesContainerRef = useRef<HTMLDivElement>(null);

	const { messages, status, sendMessage, addToolOutput } = useChat({
		id: "rule-assistant",
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
		onError: (error) => {
			toast.error(error.message ?? "Something went wrong");
		},
		transport: {
			async sendMessages(options) {
				const mailboxId = mailboxIdRef.current;
				if (!mailboxId) {
					throw new Error("No mailbox selected");
				}
				return eventIteratorToStream(
					await orpcClient.ai.rulesAssistant(
						{
							mailboxId,
							messages: options.messages,
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

	const handleSubmit = async (
		e:
			| React.FormEvent<HTMLFormElement>
			| React.KeyboardEvent<HTMLTextAreaElement>,
	) => {
		e.preventDefault();
		const text = input.trim();
		if (!text || !selectedMailboxId) {
			return;
		}
		setInput("");
		await sendMessage({ text });
	};

	const isDisabled = !selectedMailboxId;

	return (
		<div className="flex h-[500px] flex-col">
			{/* Messages */}
			<div
				ref={messagesContainerRef}
				className="flex flex-1 flex-col gap-2 overflow-y-auto px-1 py-4"
			>
				{messages.length === 0 && (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
						{isDisabled
							? "Add a mailbox to start creating rules."
							: "Describe an email rule you'd like to create..."}
					</div>
				)}

				{messages.map((message, msgIndex) => (
					<div
						key={msgIndex}
						className={cn(
							"flex flex-col gap-2",
							message.role === "user"
								? "items-end"
								: "items-start",
						)}
					>
						{message.parts?.map((part, partIndex) => {
							if (part.type === "text") {
								return (
									<div
										key={partIndex}
										className={cn(
											"max-w-2xl whitespace-pre-wrap rounded-lg px-4 py-2 text-sm",
											message.role === "user"
												? "bg-primary/10 text-foreground"
												: "bg-secondary/10 text-foreground",
										)}
									>
										{part.text}
									</div>
								);
							}

							if (part.type === "tool-proposeRule") {
								const toolPart = part as {
									type: "tool-proposeRule";
									toolCallId: string;
									state:
										| "input-streaming"
										| "input-available"
										| "output-available";
									input?: RuleProposal;
									output?: {
										action: "accepted" | "rejected";
									};
								};

								return (
									<RuleConfirmationCard
										key={partIndex}
										rule={
											(toolPart.input ??
												{}) as RuleProposal
										}
										toolCallId={toolPart.toolCallId}
										mailboxId={mailboxIdRef.current ?? ""}
										partState={toolPart.state}
										output={toolPart.output}
										addToolOutput={
											addToolOutput as (args: {
												tool: string;
												toolCallId: string;
												output: unknown;
											}) => Promise<void>
										}
									/>
								);
							}

							return null;
						})}
					</div>
				))}

				{(status === "streaming" || status === "submitted") && (
					<div className="flex justify-start">
						<div className="flex max-w-2xl items-center gap-2 rounded-lg bg-secondary/10 px-4 py-2 text-foreground">
							<EllipsisIcon className="size-6 animate-pulse" />
						</div>
					</div>
				)}
			</div>

			{/* Input */}
			<form
				onSubmit={handleSubmit}
				className="relative shrink-0 rounded-2xl bg-card focus-within:outline-none focus-within:ring focus-within:ring-primary"
			>
				<Textarea
					value={input}
					onChange={(e) => setInput(e.target.value)}
					disabled={isDisabled || status === "streaming"}
					placeholder={
						isDisabled
							? "Add a mailbox to get started..."
							: "Describe your rule, e.g. 'Archive all newsletters'"
					}
					className="min-h-8 rounded-2xl border bg-card p-6 pr-14 shadow-none focus:outline-hidden focus-visible:ring-0"
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							handleSubmit(e);
						}
					}}
				/>

				<Button
					type="submit"
					size="icon"
					variant="secondary"
					className="absolute bottom-3 right-3"
					disabled={isDisabled || !input.trim()}
				>
					<SendIcon className="size-4" />
				</Button>
			</form>
		</div>
	);
}
