import { cn } from "@repo/ui";
import { ArchiveIcon, StarIcon, TagIcon, UserXIcon } from "lucide-react";
import NextLink from "next/link";
import type { ReactNode } from "react";

interface ArchiveRow {
	icon: ReactNode;
	tone: "done" | "skip";
	from: string;
	rule: string;
	badge: string;
	badgeTone: "archived" | "labeled";
}

const rows: ArchiveRow[] = [
	{
		icon: <ArchiveIcon className="size-[13px]" />,
		tone: "done",
		from: "Substack Newsletter",
		rule: "Rule: archive all newsletters",
		badge: "Archived",
		badgeTone: "archived",
	},
	{
		icon: <TagIcon className="size-[13px]" />,
		tone: "done",
		from: "Stripe · Receipt #4821",
		rule: "Rule: label receipts → Finance",
		badge: "Labeled",
		badgeTone: "labeled",
	},
	{
		icon: <ArchiveIcon className="size-[13px]" />,
		tone: "done",
		from: "FedEx Shipping Update",
		rule: "Rule: archive shipping updates",
		badge: "Archived",
		badgeTone: "archived",
	},
	{
		icon: <UserXIcon className="size-[13px]" />,
		tone: "skip",
		from: "Cold outreach · Unknown sender",
		rule: "Rule: archive cold outreach",
		badge: "Archived",
		badgeTone: "archived",
	},
	{
		icon: <StarIcon className="size-[13px]" />,
		tone: "done",
		from: "Team · Raj Kumar",
		rule: "Rule: keep + star from team",
		badge: "Starred",
		badgeTone: "labeled",
	},
];

export function ArchiveDemo() {
	return (
		<section
			id="features"
			className="w-full scroll-mt-24 bg-background px-6 py-20 text-center sm:px-8 sm:py-24"
		>
			<span className="mb-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
				Smart archiving
			</span>
			<div className="mb-2 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Archives everything.
				<br />
				Misses nothing.
			</div>
			<p className="mb-8 text-[18px] leading-[1.5] text-foreground">
				Newsletters, receipts, shipping updates, bank statements — all
				auto-filed the moment they arrive.
			</p>

			<div className="mb-10 flex justify-center">
				<NextLink
					href="/auth/signup"
					prefetch
					className="rounded-full border border-primary bg-primary px-6 py-3 text-[15px] text-primary-foreground transition-colors hover:bg-primary/90"
				>
					See how archiving works
				</NextLink>
			</div>

			<div className="mx-auto max-w-[620px] overflow-hidden rounded-[2rem] border border-border bg-card text-left shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)]">
				<div className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-4">
					<span className="size-[10px] rounded-full bg-foreground/70" />
					<span className="size-[10px] rounded-full bg-foreground/45" />
					<span className="size-[10px] rounded-full bg-foreground/25" />
					<span className="ml-[6px] font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">
						Inbox rules — running
					</span>
				</div>

				{rows.map((row, index) => (
					<div
						key={row.from}
						className={cn(
							"flex items-center gap-[10px] px-4 py-3",
							index < rows.length - 1 && "border-b border-border",
						)}
					>
						<div
							className={cn(
								"flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground",
								row.tone === "skip" && "opacity-70",
							)}
						>
							{row.icon}
						</div>
						<div className="flex-1">
							<div className="text-[13px] font-medium text-foreground">
								{row.from}
							</div>
							<div className="text-[13px] text-foreground">
								{row.rule}
							</div>
						</div>
						<span
							className={cn(
								"rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
								row.badgeTone === "archived"
									? "border-border bg-muted text-foreground"
									: "border-primary/15 bg-primary text-primary-foreground",
							)}
						>
							{row.badge}
						</span>
					</div>
				))}
			</div>
		</section>
	);
}
