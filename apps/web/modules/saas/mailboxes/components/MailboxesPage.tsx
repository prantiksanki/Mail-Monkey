"use client";

import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import type { MailboxType } from "@repo/database/prisma/zod";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Switch } from "@repo/ui/components/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { oAuthProviders } from "@saas/auth/constants/oauth-providers";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon, UnlinkIcon } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { mailboxesQueryKey, useMailboxesQuery } from "../lib/api";
import {
	useDisableWatchMutation,
	useEnableWatchMutation,
	useMailboxStatsQuery,
} from "../lib/rules-api";
import { AddMailboxDialog } from "./AddMailboxDialog";
import { DisconnectMailboxDialog } from "./DisconnectMailboxDialog";

const GoogleIcon = oAuthProviders.google.icon;

type MailboxHealth = "healthy" | "attention" | "reconnect";

function getMailboxHealth(mailbox: MailboxType): MailboxHealth {
	const expiry = mailbox.watchExpiry ? new Date(mailbox.watchExpiry) : null;
	const isExpired = expiry ? expiry.getTime() < Date.now() : false;
	if (isExpired) {
		return "reconnect";
	}
	if (!mailbox.watchEnabled) {
		return "attention";
	}
	return "healthy";
}

export function MailboxesPage() {
	const { data: mailboxes = [], isLoading } = useMailboxesQuery();
	const { selectedMailboxId, setSelectedMailboxId } = useSelectedMailbox();

	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [disconnectingMailbox, setDisconnectingMailbox] = useState<{
		id: string;
		email: string;
	} | null>(null);

	const selectedMailbox =
		mailboxes.find((m) => m.id === selectedMailboxId) ??
		mailboxes[0] ??
		null;

	return (
		<div className="space-y-8">
			<MailboxesPageHeader />

			{isLoading ? (
				<MailboxListSkeleton />
			) : mailboxes.length === 0 ? (
				<EmptyState onConnectClick={() => setIsAddDialogOpen(true)} />
			) : (
				<>
					<div className="space-y-3">
						{mailboxes.map((mailbox) => (
							<MailboxCard
								key={mailbox.id}
								mailbox={mailbox}
								isPrimary={selectedMailbox?.id === mailbox.id}
								onSelect={() =>
									setSelectedMailboxId(mailbox.id)
								}
								onDisconnect={() =>
									setDisconnectingMailbox({
										id: mailbox.id,
										email: mailbox.email,
									})
								}
							/>
						))}
						<ConnectAnotherCard
							onClick={() => setIsAddDialogOpen(true)}
						/>
					</div>

					{selectedMailbox && (
						<MailboxDetailCard
							mailbox={selectedMailbox}
							onDisconnect={() =>
								setDisconnectingMailbox({
									id: selectedMailbox.id,
									email: selectedMailbox.email,
								})
							}
						/>
					)}
				</>
			)}

			<AddMailboxDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				existingMailboxes={mailboxes}
			/>
			{disconnectingMailbox && (
				<DisconnectMailboxDialog
					open={!!disconnectingMailbox}
					onOpenChange={(open) => {
						if (!open) {
							setDisconnectingMailbox(null);
						}
					}}
					mailboxId={disconnectingMailbox.id}
					mailboxEmail={disconnectingMailbox.email}
				/>
			)}
		</div>
	);
}

function MailboxesPageHeader() {
	const t = useTranslations();
	return (
		<div className="min-w-0 space-y-3 pb-2">
			<p className="font-mono text-foreground text-xs uppercase tracking-wider">
				{t("mailboxes.page.eyebrow")}
			</p>
			<h1 className="text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{t("mailboxes.page.title")}
			</h1>
			<p className="max-w-xl text-foreground text-sm">
				{t("mailboxes.page.subtitle")}
			</p>
		</div>
	);
}

interface MailboxCardProps {
	mailbox: MailboxType;
	isPrimary: boolean;
	onSelect: () => void;
	onDisconnect: () => void;
}

function MailboxCard({
	mailbox,
	isPrimary,
	onSelect,
	onDisconnect,
}: MailboxCardProps) {
	const t = useTranslations();
	const format = useFormatter();
	const now = useNow();
	const { data: stats } = useMailboxStatsQuery(mailbox.id);

	const health = getMailboxHealth(mailbox);
	const rulesRunning = stats?.rulesActive ?? 0;
	const lastActivity = mailbox.updatedAt
		? format.relativeTime(new Date(mailbox.updatedAt), now)
		: null;

	return (
		<div
			className={cn(
				"grid grid-cols-[1fr_auto] items-center gap-5 rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)] transition-colors",
				{
					"border-foreground/15 ring-1 ring-foreground/10": isPrimary,
					"opacity-75": health === "reconnect",
				},
			)}
		>
			<button
				type="button"
				onClick={onSelect}
				className="flex min-w-0 items-center gap-5 rounded-xl text-left transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-foreground">
					<GoogleIcon className="size-5" />
				</div>

				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<span className="truncate font-medium text-foreground text-sm">
							{mailbox.email}
						</span>
						{isPrimary && (
							<span className="inline-flex items-center rounded-full border border-foreground/15 bg-foreground px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em] text-background">
								{t("mailboxes.page.primaryBadge")}
							</span>
						)}
					</div>
					<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-foreground text-xs">
						<span>{t("mailboxes.page.meta.providerGmail")}</span>
						<span className="text-foreground">·</span>
						<span>
							{t("mailboxes.page.meta.rulesRunning", {
								count: rulesRunning,
							})}
						</span>
						{health === "reconnect" ? (
							<>
								<span className="text-foreground">·</span>
								<span className="text-foreground">
									{t("mailboxes.page.attention.expired")}
								</span>
							</>
						) : lastActivity ? (
							<>
								<span className="text-foreground">·</span>
								<span>
									{t("mailboxes.page.meta.lastActivity", {
										time: lastActivity,
									})}
								</span>
							</>
						) : null}
					</div>
				</div>
			</button>

			<div className="flex items-center gap-3">
				<MailboxHealthPill health={health} />
				{health === "reconnect" ? (
					<ReconnectButton />
				) : (
					<>
						<WatchToggle mailbox={mailbox} />
						<TooltipProvider delayDuration={0}>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-label={t(
											"mailboxes.page.menu.disconnect",
										)}
										className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
										onClick={onDisconnect}
									>
										<UnlinkIcon className="size-4" />
									</button>
								</TooltipTrigger>
								<TooltipContent>
									{t("mailboxes.page.menu.disconnect")}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					</>
				)}
			</div>
		</div>
	);
}

function MailboxHealthPill({ health }: { health: MailboxHealth }) {
	const t = useTranslations();
	if (health === "healthy") {
		return (
			<span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground">
				<span className="size-1.5 rounded-full bg-foreground" />
				{t("mailboxes.page.health.healthy")}
			</span>
		);
	}
	return (
		<span className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground">
			<span className="size-1.5 rounded-full bg-foreground/45" />
			{t("mailboxes.page.health.attention")}
		</span>
	);
}

function WatchToggle({ mailbox }: { mailbox: MailboxType }) {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const enableWatch = useEnableWatchMutation();
	const disableWatch = useDisableWatchMutation();
	const pending = enableWatch.isPending || disableWatch.isPending;

	const handleToggle = async (next: boolean) => {
		try {
			if (next) {
				await enableWatch.mutateAsync({ mailboxId: mailbox.id });
				toast.success(t("mailboxes.page.toast.resumed"));
			} else {
				await disableWatch.mutateAsync({ mailboxId: mailbox.id });
				toast.warning(t("mailboxes.page.toast.paused"));
			}
			queryClient.invalidateQueries({ queryKey: mailboxesQueryKey });
		} catch {
			toast.error(t("mailboxes.page.toast.watchError"));
		}
	};

	return (
		<Switch
			checked={mailbox.watchEnabled}
			onCheckedChange={handleToggle}
			disabled={pending}
			aria-label={t("mailboxes.page.pauseToggleLabel", {
				email: mailbox.email,
			})}
		/>
	);
}

function ReconnectButton() {
	const t = useTranslations();
	const [pending, setPending] = useState(false);

	const handleReconnect = (e: React.MouseEvent) => {
		e.stopPropagation();
		setPending(true);
		toast.info(t("mailboxes.page.toast.reconnecting"));
		const callbackURL = new URL(
			authConfig.mailboxes.defaultCallbackPath,
			window.location.origin,
		).toString();
		authClient.linkSocial({ provider: "google", callbackURL });
	};

	return (
		<Button
			variant="primary"
			size="sm"
			onClick={handleReconnect}
			loading={pending}
		>
			{pending
				? t("mailboxes.page.reconnecting")
				: t("mailboxes.page.reconnect")}
		</Button>
	);
}

function ConnectAnotherCard({ onClick }: { onClick: () => void }) {
	const t = useTranslations();
	return (
		<button
			type="button"
			onClick={onClick}
			className="group flex w-full items-center gap-4 rounded-[2rem] border border-dashed border-border bg-card p-6 text-left shadow-[0_18px_50px_-32px_rgba(0,0,0,0.16)] transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-foreground text-background transition-transform group-hover:scale-105">
				<PlusIcon className="size-5" />
			</div>
			<div className="flex-1">
				<p className="text-sm font-medium text-foreground">
					{t("mailboxes.page.connectAnother")}
				</p>
				<p className="mt-1 text-foreground text-xs">
					{t("mailboxes.page.connectNote")}
				</p>
			</div>
		</button>
	);
}

interface MailboxDetailCardProps {
	mailbox: MailboxType;
	onDisconnect: () => void;
}

function MailboxDetailCard({ mailbox, onDisconnect }: MailboxDetailCardProps) {
	const t = useTranslations();
	const format = useFormatter();
	const now = useNow();
	const { data: stats } = useMailboxStatsQuery(mailbox.id);

	const connectedOn = new Date(mailbox.createdAt);
	const lastActivity = mailbox.updatedAt
		? format.relativeTime(new Date(mailbox.updatedAt), now)
		: t("mailboxes.page.meta.noActivity");

	return (
		<div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)]">
			<h3 className="font-serif text-2xl font-normal leading-none text-foreground">
				{t("mailboxes.page.detail.title", { email: mailbox.email })}
			</h3>
			<p className="mt-2 max-w-xl text-sm text-foreground">
				{t("mailboxes.page.detail.subtitle")}
			</p>

			<dl className="mt-5 grid grid-cols-[140px_1fr] gap-x-4 gap-y-2 text-sm md:grid-cols-[180px_1fr]">
				<dt className="text-foreground">
					{t("mailboxes.page.detail.auth")}
				</dt>
				<dd className="font-mono text-foreground text-xs">
					{t("mailboxes.page.detail.authValue")}
				</dd>

				<dt className="text-foreground">
					{t("mailboxes.page.detail.scopes")}
				</dt>
				<dd className="font-mono text-foreground text-xs">
					{t("mailboxes.page.detail.scopesValue")}
				</dd>

				<dt className="text-foreground">
					{t("mailboxes.page.detail.push")}
				</dt>
				<dd>
					<span
						className={cn(
							"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.24em]",
							mailbox.watchEnabled
								? "border-foreground/15 bg-foreground text-background"
								: "border-border bg-muted text-foreground",
						)}
					>
						{mailbox.watchEnabled
							? t("mailboxes.page.detail.pushActive")
							: t("mailboxes.page.detail.pushInactive")}
					</span>
				</dd>

				<dt className="text-foreground">
					{t("mailboxes.page.detail.historyId")}
				</dt>
				<dd className="font-mono text-foreground text-xs">
					{mailbox.lastHistoryId ?? "—"}
				</dd>

				<dt className="text-foreground">
					{t("mailboxes.page.detail.processed")}
				</dt>
				<dd className="font-mono text-foreground text-xs">
					{t("mailboxes.page.detail.processedValue", {
						count: stats?.processedToday ?? 0,
						errors: stats?.errorsToday ?? 0,
					})}
				</dd>

				<dt className="text-foreground">
					{t("mailboxes.page.detail.connected")}
				</dt>
				<dd className="font-mono text-foreground text-xs">
					{t("mailboxes.page.detail.connectedValue", {
						date: format.dateTime(connectedOn, {
							dateStyle: "medium",
						}),
						relative: format.relativeTime(connectedOn, now),
					})}
				</dd>

				<dt className="text-foreground">
					{t("mailboxes.page.detail.lastActivity")}
				</dt>
				<dd className="font-mono text-foreground text-xs">
					{lastActivity}
				</dd>
			</dl>

			<div className="mt-6 flex items-center justify-between gap-2 border-border border-t pt-4">
				<DetailPauseResumeButton mailbox={mailbox} />
				<Button
					variant="ghost"
					size="sm"
					className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={onDisconnect}
				>
					{t("mailboxes.page.menu.disconnect")}
				</Button>
			</div>
		</div>
	);
}

function DetailPauseResumeButton({ mailbox }: { mailbox: MailboxType }) {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const enableWatch = useEnableWatchMutation();
	const disableWatch = useDisableWatchMutation();
	const pending = enableWatch.isPending || disableWatch.isPending;

	const handleClick = async () => {
		try {
			if (mailbox.watchEnabled) {
				await disableWatch.mutateAsync({ mailboxId: mailbox.id });
				toast.warning(t("mailboxes.page.toast.paused"));
			} else {
				await enableWatch.mutateAsync({ mailboxId: mailbox.id });
				toast.success(t("mailboxes.page.toast.resumed"));
			}
			queryClient.invalidateQueries({ queryKey: mailboxesQueryKey });
		} catch {
			toast.error(t("mailboxes.page.toast.watchError"));
		}
	};

	return (
		<Button
			variant="secondary"
			size="sm"
			onClick={handleClick}
			disabled={pending}
			loading={pending}
		>
			{mailbox.watchEnabled
				? t("mailboxes.page.detail.pause")
				: t("mailboxes.page.detail.resume")}
		</Button>
	);
}

function EmptyState({ onConnectClick }: { onConnectClick: () => void }) {
	const t = useTranslations();
	return (
		<div className="rounded-2xl border border-border border-dashed bg-muted/20 px-6 py-16 text-center">
			<h2 className="font-serif font-normal text-2xl tracking-tight">
				{t("mailboxes.page.empty.title")}
			</h2>
			<p className="mx-auto mt-2 max-w-md text-foreground text-sm">
				{t("mailboxes.page.empty.subtitle")}
			</p>
			<Button
				variant="primary"
				size="sm"
				className="mt-6"
				onClick={onConnectClick}
			>
				<PlusIcon className="size-4" />
				{t("mailboxes.page.connectCta")}
			</Button>
		</div>
	);
}

function MailboxListSkeleton() {
	return (
		<div className="space-y-3">
			<div className="h-[84px] w-full animate-pulse rounded-2xl border border-border bg-muted/20" />
			<div className="h-[84px] w-full animate-pulse rounded-2xl border border-border bg-muted/20" />
			<div className="h-[72px] w-full animate-pulse rounded-2xl border border-border border-dashed bg-muted/10" />
		</div>
	);
}
