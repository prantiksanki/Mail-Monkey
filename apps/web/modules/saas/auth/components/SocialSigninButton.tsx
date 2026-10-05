"use client";

import { authClient } from "@repo/auth/client";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { parseAsString, useQueryState } from "nuqs";
import { config } from "@/config";
import { normalizeProvider, useAnalytics } from "@/modules/analytics";
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
	const [invitationId] = useQueryState("invitationId", parseAsString);
	const { trackEvent } = useAnalytics();
	const providerData = oAuthProviders[provider];

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: config.saas.redirectAfterSignIn;

	const onSignin = async () => {
		trackEvent(intent === "signup" ? "sign_up" : "login", {
			method: normalizeProvider(provider),
		});
		const callbackURL = new URL(redirectPath, window.location.origin);
		const result = await authClient.signIn.social({
			provider,
			callbackURL: callbackURL.toString(),
		});
		if (result.error) {
			console.error("[auth] social sign-in error:", result.error);
		}
	};

	return (
		<Button
			onClick={() => onSignin()}
			variant="glass"
			type="button"
			className={cn("h-12 w-full font-semibold uppercase", className)}
		>
			{providerData.icon && (
				<i className="mr-2 text-primary">
					<providerData.icon className="size-4" />
				</i>
			)}
			{providerData.name}
		</Button>
	);
}
