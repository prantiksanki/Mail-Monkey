"use client";

import { Skeleton } from "@repo/ui/components/skeleton";
import { useInboxMessageQuery } from "@saas/mailboxes/lib/inbox-api";
import { MailIcon } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * A tappable card for one email the assistant cited. Resolves the sender/subject
 * from the mailbox and, on click, opens the original message in the Mail view.
 */
export function EmailCitationCard({
	mailboxId,
	emailId,
	onNavigate,
}: {
	mailboxId: string;
	emailId: string;
	onNavigate?: () => void;
}) {
	const router = useRouter();
	const { data, isLoading, isError } = useInboxMessageQuery(
		mailboxId,
		emailId,
	);

	const open = () => {
		onNavigate?.();
		router.push(
			`/app/mailboxes?folder=inbox&message=${encodeURIComponent(emailId)}`,
		);
	};

	if (isError) {
		return null;
	}

	return (
		<button
			type="button"
			onClick={open}
			className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-accent"
		>
			<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
				<MailIcon className="size-4" />
			</span>
			<span className="min-w-0 flex-1">
				{isLoading ? (
					<span className="block space-y-1">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="h-3 w-40" />
					</span>
				) : (
					<>
						<span className="block truncate text-xs font-medium text-foreground">
							{data?.from || "Unknown sender"}
						</span>
						<span className="block truncate text-xs text-muted-foreground">
							{data?.subject || "(no subject)"}
						</span>
					</>
				)}
			</span>
			<span className="shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
				Open →
			</span>
		</button>
	);
}
