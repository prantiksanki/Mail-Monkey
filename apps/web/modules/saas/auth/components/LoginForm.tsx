"use client";

import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import { Alert, AlertDescription } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { useAuthErrorMessages } from "@saas/auth/hooks/errors-messages";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import { FloatingPaths } from "@saas/shared/components/FloatingPaths";
import { useRouter } from "@shared/hooks/router";
import {
	AlertTriangleIcon,
	ArrowRightIcon,
	ChevronLeftIcon,
	KeyIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { withQuery } from "ufo";
import { config } from "@/config";
import {
	type OAuthProvider,
	oAuthProviders,
} from "../constants/oauth-providers";
import { useSession } from "../hooks/use-session";
import { SocialSigninButton } from "./SocialSigninButton";

export function LoginForm() {
	const t = useTranslations();
	const { getAuthErrorMessage } = useAuthErrorMessages();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loaded: sessionLoaded } = useSession();

	const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

	const signInWithPasskey = async () => {
		try {
			await authClient.signIn.passkey();

			router.replace(redirectPath);
		} catch (e) {
			setErrorMessage(
				getAuthErrorMessage(
					e && typeof e === "object" && "code" in e
						? (e.code as string)
						: undefined,
				),
			);
		}
	};

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
							{t.rich("auth.login.title", {
								accent: (chunks) => (
									<em className="italic">{chunks}</em>
								),
							})}
						</h1>
						<p className="text-muted-foreground text-base">
							{t("auth.login.subtitle")}
						</p>
					</div>

					{invitationId && (
						<OrganizationInvitationAlert className="mb-6" />
					)}

					{errorMessage && (
						<Alert variant="error">
							<AlertTriangleIcon />
							<AlertDescription>{errorMessage}</AlertDescription>
						</Alert>
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
											intent="login"
										/>
									),
								)}
							</div>
						)}

					{authConfig.enablePasskeys && (
						<Button
							variant="glass"
							className="h-12 w-full font-semibold uppercase"
							onClick={() => signInWithPasskey()}
						>
							<KeyIcon className="mr-1.5 size-4 text-primary" />
							{t("auth.login.loginWithPasskey")}
						</Button>
					)}

					<p className="text-muted-foreground text-sm text-center">
						<Link
							href="/auth/forgot-password"
							className="font-medium underline underline-offset-4 hover:text-foreground/70"
						>
							{t("auth.login.forgotPassword")}
						</Link>
					</p>

					{authConfig.enableSignup && (
						<p className="text-muted-foreground text-sm text-center">
							<span>{t("auth.login.dontHaveAnAccount")} </span>
							<Link
								href={withQuery(
									"/auth/signup",
									Object.fromEntries(searchParams.entries()),
								)}
								className="font-medium underline underline-offset-4 hover:text-foreground/70"
							>
								{t("auth.login.createAnAccount")}
								<ArrowRightIcon className="ml-1 inline size-4 align-middle" />
							</Link>
						</p>
					)}
				</div>
			</div>
		</main>
	);
}
