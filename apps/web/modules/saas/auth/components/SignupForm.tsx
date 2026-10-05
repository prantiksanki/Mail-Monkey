"use client";

import { config as authConfig } from "@repo/auth/config";
import { Button } from "@repo/ui/components/button";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import { FloatingPaths } from "@saas/shared/components/FloatingPaths";
import { ArrowRightIcon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { withQuery } from "ufo";
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
		: (redirectTo ?? config.saas.redirectAfterSignIn);

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
					<Link href="/" className="block">
						<span className="font-semibold text-xl">
							{config.appName}
						</span>
					</Link>
				</div>
				<div className="z-10 mt-auto">
					<blockquote className="space-y-2">
						<p className="text-xl">
							&ldquo;
							{t.rich("auth.aside.quote", {
								accent: (chunks) => <span>{chunks}</span>,
							})}
							&rdquo;
						</p>
						<footer className="font-mono text-sm font-semibold">
							~ {t("auth.aside.author")}
						</footer>
					</blockquote>
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
					variant="ghost"
					size="sm"
					className="absolute top-7 left-5"
					asChild
				>
					<Link href="/">
						<ChevronLeftIcon className="size-4 me-2" />
						Home
					</Link>
				</Button>

				<div className="mx-auto w-full max-w-sm space-y-4">
					<div className="flex items-center gap-2 lg:hidden">
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

					{authConfig.enableSignup &&
						authConfig.enableSocialLogin && (
							<div className="space-y-2">
								{Object.keys(oAuthProviders).map(
									(providerId) => (
										<SocialSigninButton
											key={providerId}
											provider={
												providerId as OAuthProvider
											}
											intent="signup"
										/>
									),
								)}
							</div>
						)}

					<p className="text-muted-foreground text-sm text-center">
						<span>{t("auth.signup.alreadyHaveAccount")} </span>
						<Link
							href={withQuery(
								"/auth/login",
								Object.fromEntries(searchParams.entries()),
							)}
							className="font-medium underline underline-offset-4 hover:text-foreground/70"
						>
							{t("auth.signup.signIn")}
							<ArrowRightIcon className="ml-1 inline size-4 align-middle" />
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
