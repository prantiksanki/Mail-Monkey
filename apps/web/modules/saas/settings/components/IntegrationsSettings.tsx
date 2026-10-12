"use client";

import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import type { MailboxType } from "@repo/database/prisma/zod";
import { canConnectMailbox } from "@repo/payments/lib/plan-limits";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@repo/ui/components/accordion";
import { Button } from "@repo/ui/components/button";
import { DisconnectMailboxDialog } from "@saas/mailboxes/components/DisconnectMailboxDialog";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { usePurchases } from "@saas/payments/hooks/purchases";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { CheckIcon, StarIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useFormatter } from "next-intl";
import { useEffect, useState } from "react";
import { siGooglemeet, siZoho, siZoom } from "simple-icons";
import { toast } from "sonner";
import { TelegramConnectBlock } from "./TelegramConnectBlock";

function BrandIcon({
	icon,
	className,
}: {
	icon: { path: string; hex: string };
	className?: string;
}) {
	return (
		<svg
			role="img"
			viewBox="0 0 24 24"
			className={className}
			fill={`#${icon.hex}`}
			aria-hidden="true"
		>
			<path d={icon.path} />
		</svg>
	);
}

type ProviderKey = "GOOGLE" | "OUTLOOK";

const PROVIDER_META: Record<
	ProviderKey,
	{
		name: string;
		logo: string;
		description: string;
		oauthProvider: "google" | "microsoft";
	}
> = {
	GOOGLE: {
		name: "Gmail",
		logo: "/images/gmail-logo.png",
		description:
			"Connect email to get high-quality draft replies in your tone and a categorized inbox.",
		oauthProvider: "google",
	},
	OUTLOOK: {
		name: "Outlook",
		logo: "/images/outlook-logo.png",
		description:
			"Connect Outlook to get high-quality draft replies in your tone and a categorized inbox.",
		oauthProvider: "microsoft",
	},
};

export function IntegrationsSettings() {
	const { data: mailboxes = [] } = useMailboxesQuery();
	const { activePlan } = usePurchases();
	const format = useFormatter();

	const canAddMore = activePlan
		? canConnectMailbox(activePlan.id, mailboxes.length)
		: false;

	const [connecting, setConnecting] = useState<ProviderKey | null>(null);
	const [disconnecting, setDisconnecting] = useState<{
		id: string;
		email: string;
	} | null>(null);

	const handleConnect = (provider: ProviderKey) => {
		setConnecting(provider);
		const { oauthProvider } = PROVIDER_META[provider];
		// The confirmed `gmail_connect` / `outlook_connect` conversion is fired
		// server-side after the OAuth callback links the account
		// (packages/auth/lib/analytics-events.ts).
		const callbackURL = new URL(
			authConfig.mailboxes.defaultCallbackPath,
			window.location.origin,
		).toString();
		authClient.linkSocial({ provider: oauthProvider, callbackURL });
	};

	return (
		<>
			<SettingsItem
				title="Email"
				description="Connect email to get high-quality draft replies in your tone and a categorized inbox."
			>
				<div className="grid gap-4 sm:grid-cols-2">
					{(Object.keys(PROVIDER_META) as ProviderKey[]).map(
						(provider) => {
							const meta = PROVIDER_META[provider];
							const connectedMailboxes = mailboxes.filter(
								(mailbox) => mailbox.provider === provider,
							);
							const isConnected = connectedMailboxes.length > 0;

							return (
								<div
									key={provider}
									className="flex flex-col gap-4 rounded-2xl border border-border bg-background/40 p-4"
								>
									<div className="flex items-center justify-between gap-3">
										<div className="flex min-w-0 items-center gap-3">
											<Image
												src={meta.logo}
												alt=""
												width={28}
												height={28}
												className="size-7 shrink-0 object-contain"
												aria-hidden="true"
											/>
											<div className="min-w-0">
												<p className="text-sm font-medium text-foreground">
													{meta.name}
												</p>
												<p className="text-xs text-foreground">
													{isConnected
														? `${connectedMailboxes.length} account${connectedMailboxes.length > 1 ? "s" : ""} connected`
														: "Not connected"}
												</p>
											</div>
										</div>
										<Button
											type="button"
											variant="neoPrimary"
											size="sm"
											disabled={!canAddMore}
											loading={connecting === provider}
											onClick={() =>
												handleConnect(provider)
											}
										>
											{isConnected
												? "Connect another"
												: "Connect"}
										</Button>
									</div>

									{!isConnected && (
										<p className="text-xs text-foreground">
											{meta.description}
										</p>
									)}

									{connectedMailboxes.map(
										(mailbox: MailboxType) => (
											<div
												key={mailbox.id}
												className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
											>
												<div className="flex min-w-0 items-center gap-2.5">
													<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-success">
														<CheckIcon className="size-3.5 text-success-foreground" />
													</span>
													<div className="min-w-0">
														<p className="truncate text-sm font-medium text-foreground">
															{mailbox.email}
														</p>
														<p className="text-xs text-foreground">
															Connected{" "}
															{format.dateTime(
																new Date(
																	mailbox.createdAt,
																),
																{
																	dateStyle:
																		"medium",
																},
															)}
														</p>
													</div>
												</div>
												<button
													type="button"
													aria-label={`Disconnect ${mailbox.email}`}
													className="flex size-8 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted hover:text-destructive"
													onClick={() =>
														setDisconnecting({
															id: mailbox.id,
															email: mailbox.email,
														})
													}
												>
													<Trash2Icon className="size-4" />
												</button>
											</div>
										),
									)}
								</div>
							);
						},
					)}
				</div>

				{!canAddMore && (
					<div className="mt-4 flex items-center gap-2 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-foreground">
						<StarIcon className="size-4 shrink-0 text-warning" />
						<span>
							Want more accounts?{" "}
							<Link
								href="/app/settings/billing"
								className="font-medium underline underline-offset-2"
							>
								Upgrade to Pro
							</Link>
						</span>
					</div>
				)}

				{disconnecting && (
					<DisconnectMailboxDialog
						open={!!disconnecting}
						onOpenChange={(open) => {
							if (!open) {
								setDisconnecting(null);
							}
						}}
						mailboxId={disconnecting.id}
						mailboxEmail={disconnecting.email}
					/>
				)}
			</SettingsItem>

			<TelegramConnectBlock />
			<MessagingIntegrations />
			<CalendarIntegrations />
			<IntegrationsFaq />
		</>
	);
}

interface IntegrationCardProps {
	icon: React.ReactNode;
	name: string;
	status: string;
	action: React.ReactNode;
	description?: string;
}

function IntegrationCard({
	icon,
	name,
	status,
	action,
	description,
}: IntegrationCardProps) {
	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-border bg-background/40 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-3">
					<span className="flex size-7 shrink-0 items-center justify-center text-foreground">
						{icon}
					</span>
					<div className="min-w-0">
						<p className="text-sm font-medium text-foreground">
							{name}
						</p>
						<p className="text-xs text-foreground">{status}</p>
					</div>
				</div>
				{action}
			</div>
			{description && (
				<p className="text-xs text-foreground">{description}</p>
			)}
		</div>
	);
}

// Telegram itself is rendered by <TelegramConnectBlock /> (full connect + QR)
// above this section; here we only surface the other, not-yet-available chat
// destinations.
function MessagingIntegrations() {
	return (
		<SettingsItem
			title="Messaging"
			description="Get inbox activity and briefings delivered to your favorite chat apps."
		>
			<div className="grid gap-4 sm:grid-cols-2">
				<IntegrationCard
					icon={
						<Image
							src="/images/slack-logo.svg"
							alt=""
							width={24}
							height={24}
							className="size-6 object-contain"
							aria-hidden="true"
						/>
					}
					name="Slack"
					status="Coming soon"
					description="Send inbox alerts and daily summaries to a Slack channel."
					action={
						<Button
							type="button"
							variant="neoPrimary"
							size="sm"
							disabled
						>
							Connect
						</Button>
					}
				/>
			</div>
		</SettingsItem>
	);
}

/**
 * Card for a user-managed OAuth meeting provider (Zoom, Zoho Meeting): connect
 * kicks off Better Auth's genericOAuth link flow (redirects to the provider and
 * back to this page), status is read from `/api/<providerId>/status`, and
 * disconnect removes the stored OAuth account.
 *
 * `configured` is false when the environment has no creds for the provider, in
 * which case the OAuth provider isn't registered at all and Connect stays
 * disabled rather than failing on redirect.
 */
function MeetingProviderCard({
	providerId,
	name,
	icon,
	description,
}: {
	providerId: "zoom" | "zoho";
	name: string;
	icon: { path: string; hex: string };
	description: string;
}) {
	const [status, setStatus] = useState<{
		connected: boolean;
		configured: boolean;
	} | null>(null);
	const [busy, setBusy] = useState(false);

	const connected = status?.connected ?? false;
	const configured = status?.configured ?? false;

	useEffect(() => {
		fetch(`/api/${providerId}/status`)
			.then((res) => (res.ok ? res.json() : null))
			.then(
				(data: { connected: boolean; configured: boolean } | null) => {
					setStatus(data ?? { connected: false, configured: false });
				},
			)
			.catch(() => setStatus({ connected: false, configured: false }));
	}, [providerId]);

	const connect = async () => {
		setBusy(true);
		try {
			const callbackURL = new URL(
				"/app/settings/integrations",
				window.location.origin,
			).toString();
			// The confirmed `zoom_connect` / `zoho_connect` conversion is fired
			// server-side after the OAuth callback links the account
			// (packages/auth/lib/analytics-events.ts).
			// better-auth 1.7 rewrote generic-oauth as a first-class social
			// provider (PR #9069): `oauth2.link({ providerId })` is replaced
			// by the same `linkSocial({ provider })` used above for Google.
			await authClient.linkSocial({ provider: providerId, callbackURL });
			// On success the browser redirects to the provider; if it returns here
			// (e.g. an error), drop the busy state so the button is usable again.
			setBusy(false);
		} catch {
			toast.error(`Could not start ${name} connection`);
			setBusy(false);
		}
	};

	const disconnect = async () => {
		setBusy(true);
		try {
			const res = await fetch(`/api/${providerId}/disconnect`, {
				method: "POST",
			});
			if (!res.ok) {
				throw new Error(`Failed to disconnect ${name}`);
			}
			setStatus((s) =>
				s
					? { ...s, connected: false }
					: { connected: false, configured: true },
			);
			toast.success(`${name} disconnected`);
		} catch {
			toast.error(`Could not disconnect ${name}`);
		} finally {
			setBusy(false);
		}
	};

	return (
		<IntegrationCard
			icon={<BrandIcon icon={icon} className="size-6" />}
			name={name}
			status={
				status === null
					? "Checking..."
					: !configured
						? "Not available yet"
						: connected
							? "Connected"
							: "Not connected"
			}
			description={description}
			action={
				connected ? (
					<Button
						type="button"
						variant="outline"
						size="sm"
						loading={busy}
						onClick={disconnect}
					>
						Disconnect
					</Button>
				) : (
					<Button
						type="button"
						variant="neoPrimary"
						size="sm"
						loading={busy}
						disabled={!configured}
						onClick={connect}
					>
						Connect
					</Button>
				)
			}
		/>
	);
}

function CalendarIntegrations() {
	const { data: mailboxes = [] } = useMailboxesQuery();
	const hasGoogle = mailboxes.some(
		(mailbox) => mailbox.provider === "GOOGLE",
	);
	const [reconnecting, setReconnecting] = useState(false);

	// Google Meet reuses the connected Google account's Calendar. To create Meet
	// links the account needs the calendar-write scope, so "Enable" re-runs the
	// Google OAuth link to grant it.
	const enableGoogleMeet = () => {
		setReconnecting(true);
		const callbackURL = new URL(
			authConfig.mailboxes.defaultCallbackPath,
			window.location.origin,
		).toString();
		authClient.linkSocial({ provider: "google", callbackURL });
	};

	return (
		<SettingsItem
			title="Calendar"
			description="Connect a calendar to automatically detect meeting invites and scheduling emails."
		>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<IntegrationCard
					icon={<BrandIcon icon={siGooglemeet} className="size-6" />}
					name="Google Meet"
					status={
						hasGoogle
							? "Connected via Gmail"
							: "Connect Gmail first"
					}
					description={
						hasGoogle
							? "AI can create Google Meet links from your inbox. Reconnect to grant calendar access."
							: "Connect a Gmail account above to enable Google Meet."
					}
					action={
						<Button
							type="button"
							variant="neoPrimary"
							size="sm"
							disabled={!hasGoogle}
							loading={reconnecting}
							onClick={enableGoogleMeet}
						>
							{hasGoogle ? "Reconnect" : "Connect"}
						</Button>
					}
				/>
				<IntegrationCard
					icon={
						<Image
							src="/images/outlook-logo.png"
							alt=""
							width={24}
							height={24}
							className="size-6 object-contain"
							aria-hidden="true"
						/>
					}
					name="Outlook"
					status="Coming soon"
					action={
						<Button
							type="button"
							variant="neoPrimary"
							size="sm"
							disabled
						>
							Connect
						</Button>
					}
				/>
				<MeetingProviderCard
					providerId="zoom"
					name="Zoom"
					icon={siZoom}
					description="Create Zoom meeting links from your inbox when drafting replies."
				/>
				<MeetingProviderCard
					providerId="zoho"
					name="Zoho Meeting"
					icon={siZoho}
					description="Create Zoho Meeting links from your inbox when drafting replies."
				/>
			</div>
		</SettingsItem>
	);
}

interface FaqItem {
	question: string;
	answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
	{
		question: "Which email providers can I connect?",
		answer: "Gmail and Outlook are both supported. You can connect multiple accounts across either provider and manage them all from this page.",
	},
	{
		question: "How many mailboxes can I connect on the free plan?",
		answer: "The free plan supports one connected mailbox. Upgrading to Pro lets you connect more accounts.",
	},
	{
		question: "Which meeting providers can I use?",
		answer: "Google Meet, Zoom, and Zoho Meeting can all create meeting links while you draft a reply. Google Meet uses your connected Gmail account, while Zoom and Zoho Meeting are connected separately from the Calendar section above. Slack and the Outlook calendar are still coming soon.",
	},
	{
		question: "What happens if I disconnect a mailbox?",
		answer: "Disconnecting stops all rule processing for that account. Your rules and history are kept in case you reconnect the same mailbox later.",
	},
];

function IntegrationsFaq() {
	return (
		<SettingsItem
			title="FAQ"
			description="Common questions about connecting accounts and integrations."
		>
			<Accordion type="single" collapsible className="w-full">
				{FAQ_ITEMS.map((item) => (
					<AccordionItem key={item.question} value={item.question}>
						<AccordionTrigger>{item.question}</AccordionTrigger>
						<AccordionContent className="text-foreground">
							{item.answer}
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</SettingsItem>
	);
}
