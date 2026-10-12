"use client";

import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useConfirmationAlert } from "@saas/shared/components/ConfirmationAlertProvider";
import {
	MessageSquarePlusIcon,
	MoreHorizontalIcon,
	PencilIcon,
	SparklesIcon,
	Trash2Icon,
} from "lucide-react";
import { useFormatter, useNow } from "next-intl";
import { toast } from "sonner";
import {
	useConversationsQuery,
	useDeleteConversationMutation,
	useRenameConversationMutation,
} from "../lib/ai-assistant-api";

interface ConversationListProps {
	mailboxId: string;
	onNewChat: () => void;
	onOpen: (id: string) => void;
}

export function ConversationList({
	mailboxId,
	onNewChat,
	onOpen,
}: ConversationListProps) {
	const format = useFormatter();
	// Explicit base for relativeTime (next-intl warns without it).
	const now = useNow();
	const { confirm } = useConfirmationAlert();
	const { data, isLoading } = useConversationsQuery(mailboxId);
	const renameMutation = useRenameConversationMutation(mailboxId);
	const deleteMutation = useDeleteConversationMutation(mailboxId);

	const conversations = data?.conversations ?? [];

	const handleRename = (id: string, current: string) => {
		const next = window.prompt("Rename conversation", current);
		if (next?.trim() && next.trim() !== current) {
			renameMutation.mutate(
				{ id, title: next.trim() },
				{
					onError: () => toast.error("Couldn't rename conversation"),
				},
			);
		}
	};

	const handleDelete = (id: string) => {
		confirm({
			title: "Delete conversation?",
			message: "This conversation and its messages will be removed.",
			destructive: true,
			onConfirm: () =>
				deleteMutation.mutate(id, {
					onError: () => toast.error("Couldn't delete conversation"),
				}),
		});
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Header */}
			<div className="shrink-0 border-b border-border px-4 py-4">
				<div className="flex items-center gap-2">
					<span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
						<SparklesIcon className="size-4" />
					</span>
					<div>
						<p className="text-sm font-semibold leading-tight">
							Inbox assistant
						</p>
						<p className="text-xs text-muted-foreground">
							Ask anything about your inbox
						</p>
					</div>
				</div>
				<Button className="mt-4 w-full gap-2" onClick={onNewChat}>
					<MessageSquarePlusIcon className="size-4" />
					New chat
				</Button>
			</div>

			{/* List */}
			<div className="flex-1 overflow-y-auto p-2">
				{isLoading ? (
					<div className="space-y-2 p-2">
						{[0, 1, 2].map((i) => (
							<Skeleton
								key={i}
								className="h-12 w-full rounded-xl"
							/>
						))}
					</div>
				) : conversations.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
						<p className="text-sm text-muted-foreground">
							No conversations yet.
						</p>
						<p className="text-xs text-muted-foreground">
							Start a new chat to ask about your emails, rules and
							calendar.
						</p>
					</div>
				) : (
					<ul className="space-y-1">
						{conversations.map((c) => (
							<li key={c.id}>
								<div className="group flex items-center gap-1 rounded-xl px-1 transition-colors hover:bg-accent">
									<button
										type="button"
										onClick={() => onOpen(c.id)}
										className="min-w-0 flex-1 px-2 py-2.5 text-left"
									>
										<span className="block truncate text-sm font-medium text-foreground">
											{c.title}
										</span>
										<span className="block text-xs text-muted-foreground">
											{format.relativeTime(
												new Date(c.updatedAt),
												now,
											)}
										</span>
									</button>
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
												aria-label="Conversation options"
											>
												<MoreHorizontalIcon className="size-4" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent align="end">
											<DropdownMenuItem
												onClick={() =>
													handleRename(c.id, c.title)
												}
											>
												<PencilIcon className="mr-2 size-4" />
												Rename
											</DropdownMenuItem>
											<DropdownMenuItem
												className="text-destructive focus:text-destructive"
												onClick={() =>
													handleDelete(c.id)
												}
											>
												<Trash2Icon className="mr-2 size-4" />
												Delete
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								</div>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
