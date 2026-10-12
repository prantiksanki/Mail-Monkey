"use client";

import { authClient } from "@repo/auth/client";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { config } from "@/config";
import { oAuthProviders } from "../constants/oauth-providers";

export function SocialSigninButton({
	provider,
	intent,
	className,
}: {
	provider: keyof typeof oAuthProviders;
	intent: "login" | "signup";
	className?: string;
}) {
	const t = useTranslations();
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const [isLoading, setIsLoading] = useState(false);
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: config.saas.redirectAfterSignIn;

	const onSignin = async () => {
		// The `sign_up` conversion is fired server-side from the better-auth
		// user-creation hook (see packages/auth/lib/analytics-events.ts) so it
		// counts once per real signup, not once per button click.
		setIsLoading(true);
		const callbackURL = new URL(redirectPath, window.location.origin);
		const { error } = await authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
		});
		if (error) {
			setIsLoading(false);
		}
	};

	return (
		<Button
			onClick={() => onSignin()}
			variant="reverse"
			type="button"
			loading={isLoading}
			className={cn(
				"h-12 w-full font-medium",
				providerData.buttonClassName,
				className,
			)}
		>
			{providerData.icon && (
				<i className="mr-2">
					<providerData.icon className="size-4" />
				</i>
			)}
			{intent === "signup"
				? t("auth.signup.connectWithProvider", {
						provider: providerData.consumerName,
					})
				: t("auth.login.loginWithProvider", {
						provider: providerData.name,
					})}
		</Button>
	);
}
