"use client";

import { Button } from "@repo/ui/components/button";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import {
	CheckCircle2Icon,
	MessageCircleIcon,
	PowerIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { toast } from "sonner";

type TelegramStatus = {
	connected: boolean;
	enabled: boolean;
	username: string | null;
	firstName: string | null;
	lastName: string | null;
	timezone: string;
	dailyDigestTime: string;
};

export function TelegramConnectBlock() {
	const [status, setStatus] = useState<TelegramStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [connecting, setConnecting] = useState(false);
	const [connectUrl, setConnectUrl] = useState<string | null>(null);

	const loadStatus = async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/telegram/status");
			if (!response.ok) {
				throw new Error("Failed to load Telegram status");
			}
			setStatus((await response.json()) as TelegramStatus);
		} catch {
			toast.error("Could not load Telegram status");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void loadStatus();
	}, []);

	const createLink = async () => {
		setConnecting(true);
		setConnectUrl(null);
		try {
			const response = await fetch("/api/telegram/link", {
				method: "POST",
			});
			if (!response.ok) {
				throw new Error("Failed to create Telegram link");
			}
			const data = (await response.json()) as { url: string };
			setConnectUrl(data.url);
		} catch {
			toast.error("Could not create Telegram link");
		} finally {
			setConnecting(false);
		}
	};

	const setDelivery = async (enabled: boolean) => {
		setConnecting(true);
		try {
			const response = await fetch(
				enabled ? "/api/telegram/resume" : "/api/telegram/disconnect",
				{
					method: "POST",
				},
			);
			if (!response.ok) {
				throw new Error("Failed to update Telegram");
			}
			await loadStatus();
			toast.success(
				enabled
					? "Telegram delivery resumed"
					: "Telegram delivery paused",
			);
		} catch {
			toast.error("Could not update Telegram delivery");
		} finally {
			setConnecting(false);
		}
	};

	const pauseDelivery = async () => {
		await setDelivery(false);
	};

	const resumeDelivery = async () => {
		await setDelivery(true);
	};

	const fallbackName = [status?.firstName, status?.lastName]
		.filter(Boolean)
		.join(" ");
	const displayName = status?.username || fallbackName || "Telegram";

	return (
		<SettingsItem title="Telegram briefing">
			<div className="flex flex-col gap-4">
				<div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
					<div className="flex min-w-0 items-center gap-3">
						<MessageCircleIcon className="size-5 shrink-0 text-primary" />
						<div className="min-w-0">
							<p className="m-0 truncate text-sm font-medium">
								{loading
									? "Checking Telegram"
									: status?.connected
										? displayName
										: "Not connected"}
							</p>
							<p className="m-0 text-xs text-foreground/60">
								{status?.connected
									? `${status.dailyDigestTime} - ${status.timezone}`
									: "Daily inbox digest"}
							</p>
						</div>
					</div>
					{status?.connected && (
						<CheckCircle2Icon className="size-5 shrink-0 text-success" />
					)}
				</div>

				{connectUrl && (
					<div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background/40 p-4">
						<div className="rounded-lg bg-white p-3">
							<QRCode value={connectUrl} size={160} />
						</div>
						<p className="text-center text-xs text-foreground/60">
							Scan with your phone camera to open Telegram
						</p>
						<a
							href={connectUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="text-xs text-primary underline underline-offset-2"
						>
							Or open on this device →
						</a>
						<p className="text-center text-xs text-foreground/40">
							Link expires in 15 minutes
						</p>
					</div>
				)}

				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						onClick={createLink}
						loading={connecting}
						disabled={loading}
					>
						<MessageCircleIcon className="size-4" />
						{status?.connected ? "Reconnect" : "Connect"}
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={loadStatus}
						disabled={loading || connecting}
					>
						<RefreshCwIcon className="size-4" />
						Refresh
					</Button>
					{status?.connected && status.enabled && (
						<Button
							type="button"
							variant="ghost"
							onClick={pauseDelivery}
							disabled={connecting}
						>
							<PowerIcon className="size-4" />
							Pause
						</Button>
					)}
					{status?.connected && !status.enabled && (
						<Button
							type="button"
							variant="ghost"
							onClick={resumeDelivery}
							disabled={connecting}
						>
							<PowerIcon className="size-4" />
							Resume
						</Button>
					)}
				</div>
			</div>
		</SettingsItem>
	);
}
