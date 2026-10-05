"use client";

import type { MailboxType } from "@repo/database/prisma/zod";
import { cn } from "@repo/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { orpcClient } from "@shared/lib/orpc-client";
import { useQuery } from "@tanstack/react-query";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useMailboxesQuery } from "../lib/api";
import { useSelectedMailbox } from "../lib/selected-mailbox-context";

function ProviderBadge({
	provider,
	size = "sm",
}: {
	provider: string;
	size?: "sm" | "md";
}) {
	const isGoogle = provider === "GOOGLE";
	const px = size === "sm" ? 20 : 24;
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center justify-center overflow-hidden rounded",
				size === "sm" ? "h-5 w-5" : "h-6 w-6",
			)}
		>
			<Image
				src={
					isGoogle
						? "/images/gmail-logo.png"
						: "/images/outlook-logo.png"
				}
				alt={isGoogle ? "Gmail" : "Outlook"}
				width={px}
				height={px}
				className="object-contain"
			/>
		</span>
	);
}

function UnreadBadge({ count }: { count: number }) {
	if (count === 0) {
		return null;
	}
	return (
		<span className="ml-1 shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
			{count > 99 ? "99+" : count}
		</span>
	);
}

function MailboxMenuRow({
	mailbox,
	isActive,
	enabled,
	onSelect,
}: {
	mailbox: MailboxType;
	isActive: boolean;
	enabled: boolean;
	onSelect: () => void;
}) {
	const { data } = useQuery({
		queryKey: ["inbox-unread-count", mailbox.id],
		queryFn: () =>
			orpcClient.mailboxes.inbox.list({
				mailboxId: mailbox.id,
				folder: "inbox",
				maxResults: 25,
			}),
		enabled,
		staleTime: 30_000,
	});

	const unreadCount = (
		(data?.messages ?? []) as Array<{ isUnread: boolean }>
	).filter((m) => m.isUnread).length;

	return (
		<DropdownMenuItem
			className="flex cursor-pointer items-center gap-2.5 py-2.5"
			onClick={onSelect}
		>
			<ProviderBadge provider={mailbox.provider} size="md" />
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{mailbox.email}</p>
			</div>
			<UnreadBadge count={unreadCount} />
			{isActive && (
				<CheckIcon className="size-3.5 shrink-0 text-primary" />
			)}
		</DropdownMenuItem>
	);
}

export function MailboxSwitcher({
	onSwitch,
}: {
	onSwitch: (id: string) => void;
}) {
	const { data: mailboxes = [] } = useMailboxesQuery();
	const { selectedMailboxId } = useSelectedMailbox();
	const [open, setOpen] = useState(false);

	if (mailboxes.length <= 1) {
		return null;
	}

	const active = mailboxes.find((m) => m.id === selectedMailboxId);
	const googleMailboxes = mailboxes.filter((m) => m.provider === "GOOGLE");
	const outlookMailboxes = mailboxes.filter((m) => m.provider === "OUTLOOK");

	const handleSelect = (id: string) => {
		onSwitch(id);
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					data-testid="mailbox-switcher"
					className="flex items-center gap-1.5 rounded-md border border-transparent px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none"
					aria-label="Switch mailbox"
				>
					<ProviderBadge provider={active?.provider ?? "GOOGLE"} />
					<span className="hidden max-w-[180px] truncate sm:inline">
						{active?.email}
					</span>
					<ChevronDownIcon className="size-3.5 shrink-0" />
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-72">
				{googleMailboxes.map((m) => (
					<MailboxMenuRow
						key={m.id}
						mailbox={m}
						isActive={m.id === selectedMailboxId}
						enabled={open || m.id === selectedMailboxId}
						onSelect={() => handleSelect(m.id)}
					/>
				))}
				{googleMailboxes.length > 0 && outlookMailboxes.length > 0 && (
					<DropdownMenuSeparator />
				)}
				{outlookMailboxes.map((m) => (
					<MailboxMenuRow
						key={m.id}
						mailbox={m}
						isActive={m.id === selectedMailboxId}
						enabled={open || m.id === selectedMailboxId}
						onSelect={() => handleSelect(m.id)}
					/>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
