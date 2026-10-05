"use client";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	type OAuthProvider,
	oAuthProviders,
} from "@saas/auth/constants/oauth-providers";
import { useUserAccountsQuery } from "@saas/auth/lib/api";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { CheckCircle2Icon, LinkIcon, UnlinkIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DisconnectMailboxDialog } from "@/modules/saas/mailboxes/components/DisconnectMailboxDialog";
import { useMailboxesQuery } from "@/modules/saas/mailboxes/lib/api";

export function ConnectedAccountsBlock() {
	const t = useTranslations();

	const { data, isPending } = useUserAccountsQuery();
	const { data: mailboxes = [] } = useMailboxesQuery();
	const [disconnectingMailbox, setDisconnectingMailbox] = useState<{
		id: string;
		email: string;
	} | null>(null);

	const isProviderLinked = (provider: OAuthProvider) =>
		data?.some((account) => account.providerId === provider);

	const linkProvider = (provider: OAuthProvider) => {
		const callbackURL = window.location.href;
		if (!isProviderLinked(provider)) {
			authClient.linkSocial({
				provider,
				callbackURL,
			});
		}
	};

	const getGoogleMailbox = () => {
		return mailboxes.find((m) => m.provider === "GOOGLE");
	};

	return (
		<SettingsItem
			title={t("settings.account.security.connectedAccounts.title")}
		>
			<div className="grid grid-cols-1 divide-y">
				{Object.entries(oAuthProviders).map(
					([provider, providerData]) => {
						const isLinked = isProviderLinked(
							provider as OAuthProvider,
						);
						const googleMailbox =
							provider === "google" ? getGoogleMailbox() : null;

						return (
							<div
								key={provider}
								className="flex h-14 items-center justify-between gap-2 py-2"
							>
								<div className="flex items-center gap-2">
									<providerData.icon className="size-4 text-primary/50" />
									<span className="text-sm">
										{providerData.name}
									</span>
								</div>
								{isPending ? (
									<Skeleton className="h-10 w-28" />
								) : isLinked &&
									googleMailbox &&
									mailboxes.length > 1 ? (
									<div className="flex items-center gap-2">
										<CheckCircle2Icon className="size-5 text-success" />
										<Button
											variant="ghost"
											size="sm"
											className="text-destructive hover:text-destructive"
											onClick={() =>
												setDisconnectingMailbox({
													id: googleMailbox.id,
													email: googleMailbox.email,
												})
											}
										>
											<UnlinkIcon className="mr-1.5 size-3.5" />
											{t(
												"mailboxes.disconnectDialog.confirm",
											)}
										</Button>
									</div>
								) : isLinked ? (
									<CheckCircle2Icon className="size-6 text-success" />
								) : (
									<Button
										variant={
											isLinked ? "outline" : "secondary"
										}
										onClick={() =>
											linkProvider(
												provider as OAuthProvider,
											)
										}
									>
										<LinkIcon className="mr-1.5 size-4" />
										<span>
											{t(
												"settings.account.security.connectedAccounts.connect",
											)}
										</span>
									</Button>
								)}
							</div>
						);
					},
				)}
			</div>
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
		</SettingsItem>
	);
}
