"use client";

import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import { Logo } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { OrganizationInvitationAlert } from "@saas/organizations/components/OrganizationInvitationAlert";
import { FloatingPaths } from "@saas/shared/components/FloatingPaths";
import { useRouter } from "@shared/hooks/router";
import { getSafeRedirectPath } from "@shared/lib/safe-redirect";
import { CheckCircle2Icon, ChevronLeftIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { config } from "@/config";
import {
	type OAuthProvider,
	oAuthProviders,
} from "../constants/oauth-providers";
import { useAuthErrorMessages } from "../hooks/errors-messages";
import { useSession } from "../hooks/use-session";
import { SocialSigninButton } from "./SocialSigninButton";

export function LoginForm() {
	const t = useTranslations();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { user, loaded: sessionLoaded } = useSession();
	const { getAuthErrorMessage } = useAuthErrorMessages();

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

	const [magicLinkEmail, setMagicLinkEmail] = useState("");
	const [magicLinkSentTo, setMagicLinkSentTo] = useState<string | null>(null);
	const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
	const [magicLinkPending, setMagicLinkPending] = useState(false);

	const onMagicLinkSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setMagicLinkError(null);
		setMagicLinkPending(true);

		const { error } = await authClient.signIn.magicLink({
			email: magicLinkEmail,
			callbackURL: redirectPath,
		});

		setMagicLinkPending(false);

		if (error) {
			setMagicLinkError(
				getAuthErrorMessage(
					"code" in error ? (error.code as string) : undefined,
				),
			);
			return;
		}

		setMagicLinkSentTo(magicLinkEmail);
	};

	return (
		<main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
			{/* Left decorative panel */}
			<div className="bg-muted/60 relative hidden h-full flex-col border-r p-10 lg:flex">
				<div className="from-background absolute inset-0 z-10 bg-gradient-to-t to-transparent" />
				<div className="z-10 flex items-center gap-2">
					<Link href="/" className="flex items-center gap-2">
						<Logo className="h-12" />
					</Link>
				</div>
				<div className="z-10 flex-1" />
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
						<Logo className="h-10" />
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

					<div className="flex items-center gap-3">
						<div className="h-px flex-1 bg-border" />
						<span className="text-muted-foreground text-xs uppercase tracking-wider">
							{t("auth.login.continueWith")}
						</span>
						<div className="h-px flex-1 bg-border" />
					</div>

					{magicLinkSentTo ? (
						<div className="flex flex-col items-center space-y-2 text-center">
							<CheckCircle2Icon className="size-8 text-primary" />
							<p className="text-muted-foreground text-sm">
								{t("auth.login.hints.linkSent.message")}
							</p>
							<p className="text-muted-foreground text-sm">
								{magicLinkSentTo}
							</p>
						</div>
					) : (
						<form
							onSubmit={onMagicLinkSubmit}
							className="space-y-2"
						>
							{magicLinkError && (
								<p className="text-destructive text-sm">
									{magicLinkError}
								</p>
							)}
							<Input
								type="email"
								required
								autoComplete="email"
								placeholder="you@yourdomain.com"
								value={magicLinkEmail}
								onChange={(e) =>
									setMagicLinkEmail(e.target.value)
								}
							/>
							<Button
								type="submit"
								variant="secondary"
								className="w-full"
								loading={magicLinkPending}
							>
								{t("auth.login.sendMagicLink")}
							</Button>
						</form>
					)}

					{authConfig.enablePasswordLogin && (
						<p className="text-muted-foreground text-sm text-center">
							<Link
								href="/auth/forgot-password"
								className="font-medium underline underline-offset-4 hover:text-foreground/70"
							>
								{t("auth.login.forgotPassword")}
							</Link>
						</p>
					)}

					{authConfig.enableSignup && (
						<p className="text-muted-foreground text-sm text-center">
							{t("auth.login.dontHaveAnAccount")}{" "}
							<Link
								href="/auth/signup"
								className="font-medium underline underline-offset-4 hover:text-foreground/70"
							>
								{t("auth.login.createAnAccount")}
							</Link>
						</p>
					)}
				</div>
			</div>
		</main>
	);
}
