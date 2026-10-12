"use client";

import type { MailboxType } from "@repo/database/prisma/zod";
import { cn } from "@repo/ui";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import {
	ALL_MAILBOXES_SCOPE,
	type MailboxScope,
	useSelectedMailbox,
} from "@saas/mailboxes/lib/selected-mailbox-context";
import { CheckIcon, ChevronDownIcon, LayersIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

function ProviderMark({
	provider,
	size = 20,
}: {
	provider: MailboxType["provider"];
	size?: number;
}) {
	const isGoogle = provider === "GOOGLE";
	return (
		<span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded">
			<Image
				src={
					isGoogle
						? "/images/gmail-logo.png"
						: "/images/outlook-logo.png"
				}
				alt={isGoogle ? "Gmail" : "Outlook"}
				width={size}
				height={size}
				className="object-contain"
			/>
		</span>
	);
}

function AllMark({ size = 20 }: { size?: number }) {
	return (
		<span
			className="grid shrink-0 grid-cols-2 gap-px overflow-hidden rounded"
			style={{ width: size, height: size }}
		>
			<span className="bg-[#ea4335]" />
			<span className="bg-[#0a63d1]" />
		</span>
	);
}

/**
 * Lets the user pick which inbox's data they're looking at — a single
 * connected mailbox, or "All mailboxes" to see combined activity across
 * every one. Used on pages whose content is scoped per-mailbox (Dashboard,
 * Rules) so the active scope is always explicit instead of implicit.
 *
 * Renders nothing when there's zero or one mailbox connected — there's
 * nothing meaningful to switch between yet.
 */
export function MailboxScopeSwitcher() {
	const { data: mailboxes = [] } = useMailboxesQuery();
	const { selectedMailboxId, setSelectedMailboxId } = useSelectedMailbox();
	const [open, setOpen] = useState(false);

	if (mailboxes.length <= 1) {
		return null;
	}

	const isAll = selectedMailboxId === ALL_MAILBOXES_SCOPE;
	const active = mailboxes.find((m) => m.id === selectedMailboxId);

	const handleSelect = (scope: MailboxScope) => {
		setSelectedMailboxId(scope);
		setOpen(false);
	};

	return (
		<DropdownMenu open={open} onOpenChange={setOpen}>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					data-testid="mailbox-scope-switcher"
					className="flex items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pr-2 pl-3 text-sm shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-colors hover:border-foreground/25"
					aria-label="Choose which inbox to view"
				>
					{isAll ? (
						<AllMark />
					) : (
						<ProviderMark provider={active?.provider ?? "GOOGLE"} />
					)}
					<span className="flex min-w-0 flex-col items-start leading-tight">
						<span className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.18em]">
							Viewing
						</span>
						<span className="max-w-[200px] truncate font-semibold text-xs">
							{isAll ? "All mailboxes" : active?.email}
						</span>
					</span>
					<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted">
						<ChevronDownIcon className="size-3.5 text-muted-foreground" />
					</span>
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-80">
				<DropdownMenuLabel className="text-muted-foreground text-xs">
					Your inboxes
				</DropdownMenuLabel>
				{mailboxes.map((m) => (
					<DropdownMenuItem
						key={m.id}
						className="flex cursor-pointer items-center gap-2.5 py-2.5"
						onClick={() => handleSelect(m.id)}
					>
						<ProviderMark provider={m.provider} />
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm">{m.email}</p>
							<p className="text-muted-foreground text-xs">
								{m.provider === "GOOGLE" ? "Gmail" : "Outlook"}
							</p>
						</div>
						{m.id === selectedMailboxId && (
							<CheckIcon className="size-3.5 shrink-0 text-primary" />
						)}
					</DropdownMenuItem>
				))}
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className={cn(
						"flex cursor-pointer items-center gap-2.5 py-2.5",
						isAll && "bg-primary-soft",
					)}
					onClick={() => handleSelect(ALL_MAILBOXES_SCOPE)}
				>
					<span className="flex size-5 shrink-0 items-center justify-center rounded bg-muted">
						<LayersIcon className="size-3.5 text-muted-foreground" />
					</span>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm">All mailboxes</p>
						<p className="text-muted-foreground text-xs">
							Combined activity across every connected inbox
						</p>
					</div>
					{isAll && (
						<CheckIcon className="size-3.5 shrink-0 text-primary" />
					)}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
