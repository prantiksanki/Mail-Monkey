"use client";

import { authClient } from "@repo/auth/client";
import { config } from "@repo/auth/config";
import { canConnectMailbox } from "@repo/payments/lib/plan-limits";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { oAuthProviders } from "@saas/auth/constants/oauth-providers";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

interface AddMailboxDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	existingMailboxes: Array<{
		id: string;
		email: string;
		provider: string;
	}>;
}

type ProviderId = "google" | "outlook";

interface ProviderRow {
	id: ProviderId;
	icon: React.ReactNode;
	enabled: boolean;
}

function OutlookIcon({ className }: { className?: string }) {
	return (
		<svg
			viewBox="0 0 48 48"
			className={className}
			role="img"
			aria-label="Outlook"
		>
			<rect x="6" y="10" width="28" height="28" rx="3" fill="#0078D4" />
			<text
				x="20"
				y="30"
				fontFamily="Arial"
				fontSize="14"
				fontWeight="700"
				fill="#FFF"
				textAnchor="middle"
			>
				O
			</text>
		</svg>
	);
}

export function AddMailboxDialog({
	open,
	onOpenChange,
	existingMailboxes,
}: AddMailboxDialogProps) {
	const t = useTranslations();
	const { activePlan } = usePurchases();
	const canAdd = activePlan
		? canConnectMailbox(activePlan.id, existingMailboxes.length)
		: false;
	const [isConnecting, setIsConnecting] = useState<string | null>(null);

	const GoogleProviderIcon = oAuthProviders.google.icon;

	const supported = config.mailboxes
		.supportedProviders as unknown as readonly string[];

	const providers: ProviderRow[] = [
		{
			id: "google",
			icon: <GoogleProviderIcon className="size-6" />,
			enabled: supported.includes("google"),
		},
		{
			id: "outlook",
			icon: <OutlookIcon className="size-7" />,
			enabled: supported.includes("microsoft"),
		},
	];

	const handleConnect = (providerId: string) => {
		setIsConnecting(providerId);
		// The confirmed `gmail_connect` / `outlook_connect` conversion is fired
		// server-side after the OAuth callback links the account
		// (packages/auth/lib/analytics-events.ts), so an abandoned OAuth flow
		// no longer counts.
		// "outlook" UI row maps to the "microsoft" Better Auth provider
		const oauthProvider =
			providerId === "outlook" ? "microsoft" : providerId;
		const callbackURL = new URL(
			config.mailboxes.defaultCallbackPath,
			window.location.origin,
		).toString();
		authClient.linkSocial({
			provider: oauthProvider as "google" | "microsoft",
			callbackURL,
		});
		onOpenChange(false);
	};

	return (
		<>
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
					<DialogHeader className="space-y-2 border-border border-b p-6 text-left">
						<p className="font-mono text-foreground text-xs uppercase tracking-wider">
							{t("mailboxes.addMailboxDialog.eyebrow")}
						</p>
						<DialogTitle className="font-serif font-normal text-3xl leading-tight tracking-tight">
							{t("mailboxes.addMailboxDialog.heading")}
						</DialogTitle>
						<DialogDescription className="sr-only">
							{t("mailboxes.addMailboxDialog.description")}
						</DialogDescription>
					</DialogHeader>

					<div className="max-h-[60vh] space-y-2.5 overflow-y-auto p-6">
						{!canAdd && (
							<p className="rounded-lg border border-border bg-muted/40 p-3 text-foreground text-xs">
								{t("limits.upgrade.addMailbox")}
							</p>
						)}

						{providers.map((provider) => (
							<ProviderButton
								key={provider.id}
								providerId={provider.id}
								icon={provider.icon}
								enabled={provider.enabled && canAdd}
								loading={isConnecting === provider.id}
								onClick={() => handleConnect(provider.id)}
							/>
						))}

						<div className="pt-4">
							<p className="font-mono text-foreground text-xs uppercase tracking-wider">
								{t("mailboxes.addMailboxDialog.scopes.title")}
							</p>
							<ul className="mt-2.5 space-y-1.5 text-foreground text-xs leading-relaxed">
								<li className="flex gap-2">
									<span className="text-primary">✓</span>
									<span>
										{t(
											"mailboxes.addMailboxDialog.scopes.read",
										)}
									</span>
								</li>
								<li className="flex gap-2">
									<span className="text-primary">✓</span>
									<span>
										{t(
											"mailboxes.addMailboxDialog.scopes.labels",
										)}
									</span>
								</li>
								<li className="flex gap-2">
									<span className="text-foreground">—</span>
									<span>
										{t(
											"mailboxes.addMailboxDialog.scopes.never",
										)}
									</span>
								</li>
							</ul>
						</div>
					</div>

					<div className="flex items-center justify-between border-border border-t p-4">
						<p className="text-foreground/50 text-xs leading-snug">
							By connecting, you agree to our{" "}
							<Link
								href="/legal/privacy-policy"
								className="underline underline-offset-2 hover:text-foreground"
								target="_blank"
								rel="noopener noreferrer"
							>
								Privacy Policy
							</Link>
							. Your email data is used only to power Zer0Email
							features and is never sold or used for ads.
						</p>
						<Button
							variant="ghost"
							size="sm"
							className="ml-4 shrink-0"
							onClick={() => onOpenChange(false)}
						>
							{t("mailboxes.addMailboxDialog.cancel")}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

interface ProviderButtonProps {
	providerId: ProviderId;
	icon: React.ReactNode;
	enabled: boolean;
	loading: boolean;
	onClick: () => void;
}

function ProviderButton({
	providerId,
	icon,
	enabled,
	loading,
	onClick,
}: ProviderButtonProps) {
	const t = useTranslations();
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={!enabled || loading}
			className="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:border-border disabled:hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="flex size-10 shrink-0 items-center justify-center">
				{icon}
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-foreground text-sm">
					{t(
						`mailboxes.addMailboxDialog.providers.${providerId}.name`,
					)}
				</p>
				<p className="mt-0.5 text-foreground text-xs">
					{t(
						`mailboxes.addMailboxDialog.providers.${providerId}.description`,
					)}
				</p>
			</div>
			{enabled ? (
				<ChevronRightIcon className="size-4 shrink-0 text-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
			) : (
				<span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground uppercase tracking-wider">
					{t("mailboxes.addMailboxDialog.comingSoon")}
				</span>
			)}
		</button>
	);
}
