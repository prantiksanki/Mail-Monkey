"use client";

import { config as authConfig } from "@repo/auth/config";
import { Button } from "@repo/ui/components/button";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import { FloatingPaths } from "@saas/shared/components/FloatingPaths";
import { MailMonkeyInboxDemo } from "@saas/shared/components/MailMonkeyInboxDemo";
import { getSafeRedirectPath } from "@shared/lib/safe-redirect";
import { ChevronLeftIcon, MailIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { config } from "@/config";
import { useSession } from "@/modules/saas/auth/hooks/use-session";
import {
	type OAuthProvider,
	oAuthProviders,
} from "../constants/oauth-providers";
import { SocialSigninButton } from "./SocialSigninButton";

export function SignupForm() {
	const t = useTranslations();
	const router = useRouter();
	const { user, loaded: sessionLoaded } = useSession();
	const searchParams = useSearchParams();

	const invitationId = searchParams.get("invitationId");
	const redirectTo = searchParams.get("redirectTo");

	const redirectPath = invitationId
		? `/organization-invitation/${invitationId}`
		: getSafeRedirectPath(redirectTo, config.saas.redirectAfterSignIn);

	useEffect(() => {
		if (sessionLoaded && user) {
			router.replace(redirectPath);
		}
	}, [user, sessionLoaded]);

	return (
		<main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
			{/* Left decorative panel */}
			<div className="bg-muted/60 relative hidden h-full flex-col border-r p-10 lg:flex">
				<div className="from-background absolute inset-0 z-10 bg-gradient-to-t to-transparent" />
				<div className="z-10 flex items-center gap-2">
					<Link href="/" className="flex items-center gap-2">
						<Image
							src="/images/mailmonkey-icon.png"
							alt=""
							width={221}
							height={160}
							className="h-7 w-auto"
							priority
						/>
						<span className="font-semibold text-xl">
							{config.appName}
						</span>
					</Link>
				</div>
				<div className="z-10 flex flex-1 items-center justify-center">
					<MailMonkeyInboxDemo />
				</div>
				<div className="absolute inset-0">
					<FloatingPaths position={1} />
					<FloatingPaths position={-1} />
				</div>
			</div>

			{/* Right auth panel */}
			<div className="relative flex min-h-screen flex-col justify-center p-4">
				<div
					aria-hidden
					className="absolute inset-0 -z-10 bg-background"
				/>

				<Button
					variant="neoPrimary"
					size="sm"
					className="absolute top-10 left-5 bg-[#0663DA] text-white shadow-[4px_4px_0px_0px_#00388F] hover:bg-[#0663DA]/90 hover:shadow-[2px_2px_0px_0px_#00388F]"
					asChild
				>
					<Link href="/">
						<ChevronLeftIcon className="size-4 me-2" />
						Home
					</Link>
				</Button>

				<div className="mx-auto w-full max-w-sm space-y-4">
					<div className="flex items-center gap-2 lg:hidden">
						<Image
							src="/images/mailmonkey-icon.png"
							alt=""
							width={221}
							height={160}
							className="h-7 w-auto"
						/>
						<span className="font-semibold text-xl">
							{config.appName}
						</span>
					</div>

					<div className="flex flex-col space-y-1">
						<h1 className="text-2xl font-bold tracking-wide">
							{t.rich("auth.signup.title", {
								accent: (chunks) => (
									<em className="italic">{chunks}</em>
								),
							})}
						</h1>
						<p className="text-muted-foreground text-base">
							{t("auth.signup.message")}
						</p>
					</div>

					{invitationId && (
						<OrganizationInvitationAlert className="mb-6" />
					)}

					<div className="space-y-2">
						{authConfig.enableSignup &&
							authConfig.enableSocialLogin &&
							Object.keys(oAuthProviders).map((providerId) => (
								<SocialSigninButton
									key={providerId}
									provider={providerId as OAuthProvider}
									intent="signup"
								/>
							))}

						<Button
							variant="reverse"
							className="h-12 w-full bg-white font-medium text-black hover:bg-white/90"
							asChild
						>
							<Link href="/auth/connect-mailbox">
								<MailIcon className="mr-2 size-4" />
								Connect with custom email
							</Link>
						</Button>
					</div>

					<p className="text-muted-foreground text-sm text-center">
						{t("auth.signup.alreadyHaveAccount")}{" "}
						<Link
							href="/auth/login"
							className="font-medium underline underline-offset-4 hover:text-foreground/70"
						>
							{t("auth.signup.signIn")}
						</Link>
					</p>

					<p className="text-muted-foreground text-xs">
						By clicking continue, you agree to our{" "}
						<a
							href="/legal/terms"
							className="hover:text-foreground/70 underline underline-offset-4"
						>
							Terms of Service
						</a>{" "}
						and{" "}
						<a
							href="/legal/privacy-policy"
							className="hover:text-foreground/70 underline underline-offset-4"
						>
							Privacy Policy
						</a>
						.
					</p>
				</div>
			</div>
		</main>
	);
}
