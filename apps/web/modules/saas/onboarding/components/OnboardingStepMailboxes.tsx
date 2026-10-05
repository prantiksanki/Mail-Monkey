"use client";

import { Button } from "@repo/ui/components/button";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CheckIcon,
	MailIcon,
	PlusIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

interface OnboardingStepMailboxesProps {
	onBack: () => void;
	onCompleted: () => void;
}

export function OnboardingStepMailboxes({
	onBack,
	onCompleted,
}: OnboardingStepMailboxesProps) {
	const t = useTranslations();
	const { data: mailboxes = [], isLoading } = useMailboxesQuery();

	return (
		<div>
			<p className="font-mono text-foreground/50 text-xs uppercase tracking-wider">
				{t("onboarding.mailboxes.eyebrow")}
			</p>
			<h1 className="mt-3 text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{t.rich("onboarding.mailboxes.heading", {
					accent: (chunks) => (
						<em className="italic text-primary">{chunks}</em>
					),
				})}
			</h1>
			<p className="mt-4 max-w-lg text-foreground/60">
				{t("onboarding.mailboxes.description")}
			</p>

			<div className="mt-8 space-y-2.5">
				{isLoading && (
					<div className="h-16 animate-pulse rounded-xl bg-muted" />
				)}
				{!isLoading &&
					mailboxes.map((mailbox) => (
						<div
							key={mailbox.id}
							className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary-soft/40 p-4"
						>
							<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background">
								<MailIcon className="size-5 text-primary-deep" />
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">
									{mailbox.email}
								</p>
								<p className="text-foreground/60 text-xs">
									{t("onboarding.mailboxes.provider.google")}
								</p>
							</div>
							<span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 font-medium text-primary-foreground text-xs">
								<CheckIcon className="size-3" strokeWidth={3} />
								{t("onboarding.mailboxes.connected")}
							</span>
						</div>
					))}
			</div>

			<div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-border/70 bg-muted/30 p-4">
				<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background text-foreground/50">
					<PlusIcon className="size-5" />
				</div>
				<div className="min-w-0 flex-1">
					<p className="font-medium text-sm">
						{t("onboarding.mailboxes.addMore.title")}
					</p>
					<p className="mt-0.5 text-foreground/60 text-xs">
						{t("onboarding.mailboxes.addMore.description")}
					</p>
				</div>
			</div>

			<div className="mt-8 flex items-center justify-between">
				<Button variant="ghost" onClick={onBack}>
					<ArrowLeftIcon className="mr-2 size-4" />
					{t("onboarding.back")}
				</Button>
				<Button onClick={onCompleted} disabled={mailboxes.length === 0}>
					{t("onboarding.mailboxes.continue")}
					<ArrowRightIcon className="ml-2 size-4" />
				</Button>
			</div>
		</div>
	);
}
