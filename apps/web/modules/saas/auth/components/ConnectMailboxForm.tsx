"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Logo } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { PasswordInput } from "@repo/ui/components/password-input";
import { Switch } from "@repo/ui/components/switch";
import { useVerifyImapMailboxMutation } from "@saas/mailboxes/lib/api";
import { FloatingPaths } from "@saas/shared/components/FloatingPaths";
import { MailMonkeyInboxDemo } from "@saas/shared/components/MailMonkeyInboxDemo";
import { CheckCircle2Icon, ChevronLeftIcon, MailIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuthErrorMessages } from "../hooks/errors-messages";

const formSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	imapHost: z.string().min(1),
	imapPort: z.coerce.number().int().min(1).max(65535),
	imapSecure: z.boolean(),
	smtpHost: z.string().min(1),
	smtpPort: z.coerce.number().int().min(1).max(65535),
	smtpSecure: z.boolean(),
});

export function ConnectMailboxForm() {
	const t = useTranslations();
	const searchParams = useSearchParams();
	const { getAuthErrorMessage } = useAuthErrorMessages();
	const verifyImap = useVerifyImapMailboxMutation();
	const [sentTo, setSentTo] = useState<string | null>(null);
	const [magicLinkError, setMagicLinkError] = useState<string | null>(null);
	const [resending, setResending] = useState(false);

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: searchParams.get("email") ?? "",
			password: "",
			imapHost: "",
			imapPort: 993,
			imapSecure: true,
			smtpHost: "",
			smtpPort: 465,
			smtpSecure: true,
		},
	});

	// The magic-link email is single-use and short-lived — link scanners in
	// some email clients/gateways can pre-fetch and consume it before the
	// user's own click, so surface that instead of silently landing on an
	// empty mailboxes page (the verified credentials are still held
	// server-side, so a resend just needs a fresh token).
	useEffect(() => {
		const authError = searchParams.get("error");
		if (authError) {
			setMagicLinkError(getAuthErrorMessage(authError));
		}
	}, [searchParams]);

	const sendMagicLink = async (email: string) => {
		const { error } = await authClient.signIn.magicLink({
			email,
			callbackURL: "/app/mailboxes",
			errorCallbackURL: `/auth/connect-mailbox?email=${encodeURIComponent(email)}`,
		});

		if (error) {
			setMagicLinkError(
				getAuthErrorMessage(
					"code" in error ? (error.code as string) : undefined,
				),
			);
			return false;
		}

		setMagicLinkError(null);
		setSentTo(email);
		return true;
	};

	const onSubmit = form.handleSubmit(async (values) => {
		setMagicLinkError(null);
		try {
			await verifyImap.mutateAsync(values);
		} catch (error) {
			form.setError("root", {
				message:
					error instanceof Error
						? error.message
						: t("mailboxes.connectImapDialog.error"),
			});
			return;
		}

		await sendMagicLink(values.email);
	});

	const onResend = async () => {
		const email = searchParams.get("email");
		if (!email) {
			return;
		}
		setResending(true);
		try {
			await sendMagicLink(email);
		} finally {
			setResending(false);
		}
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

				{sentTo ? (
					<div className="mx-auto flex w-full max-w-sm flex-col items-center space-y-4 text-center">
						<CheckCircle2Icon className="size-10 text-primary" />
						<h1 className="text-2xl font-bold tracking-wide">
							{t("mailboxes.connectStandalone.checkEmailTitle")}
						</h1>
						<p className="text-muted-foreground text-base">
							{t("auth.signup.hints.verifyEmail")}
						</p>
						<p className="text-muted-foreground text-sm">
							{sentTo}
						</p>
					</div>
				) : magicLinkError && searchParams.get("email") ? (
					<div className="mx-auto flex w-full max-w-sm flex-col items-center space-y-4 text-center">
						<h1 className="text-2xl font-bold tracking-wide">
							{t("mailboxes.connectImapDialog.title")}
						</h1>
						<p className="text-destructive text-sm">
							{magicLinkError}
						</p>
						<p className="text-muted-foreground text-sm">
							{searchParams.get("email")}
						</p>
						<Button
							onClick={onResend}
							loading={resending}
							className="w-full max-w-xs"
						>
							{t("mailboxes.connectStandalone.resendLink")}
						</Button>
					</div>
				) : (
					<div className="mx-auto w-full max-w-sm space-y-4">
						<div className="flex items-center gap-2 lg:hidden">
							<Logo className="h-10" />
						</div>

						<div className="flex flex-col space-y-1">
							<h1 className="text-2xl font-bold tracking-wide">
								{t("mailboxes.connectImapDialog.title")}
							</h1>
							<p className="text-muted-foreground text-base">
								{t("mailboxes.connectImapDialog.description")}
							</p>
						</div>

						<Form {...form}>
							<form onSubmit={onSubmit} className="space-y-4">
								{form.formState.errors.root && (
									<p className="text-destructive text-sm">
										{form.formState.errors.root.message}
									</p>
								)}
								{magicLinkError && (
									<p className="text-destructive text-sm">
										{magicLinkError}
									</p>
								)}

								<FormField
									control={form.control}
									name="email"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t(
													"mailboxes.connectImapDialog.email",
												)}
											</FormLabel>
											<FormControl>
												<Input
													type="email"
													autoComplete="email"
													placeholder="you@yourdomain.com"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="password"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t(
													"mailboxes.connectImapDialog.password",
												)}
											</FormLabel>
											<FormControl>
												<PasswordInput
													autoComplete="current-password"
													{...field}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-3 gap-2">
									<div className="col-span-2">
										<FormField
											control={form.control}
											name="imapHost"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														{t(
															"mailboxes.connectImapDialog.imapHost",
														)}
													</FormLabel>
													<FormControl>
														<Input
															placeholder="imap.yourdomain.com"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
									<FormField
										control={form.control}
										name="imapPort"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													{t(
														"mailboxes.connectImapDialog.port",
													)}
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														{...field}
														value={
															field.value as number
														}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<FormField
									control={form.control}
									name="imapSecure"
									render={({ field }) => (
										<FormItem className="flex items-center justify-between">
											<FormLabel className="font-normal">
												{t(
													"mailboxes.connectImapDialog.imapSecure",
												)}
											</FormLabel>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<div className="grid grid-cols-3 gap-2">
									<div className="col-span-2">
										<FormField
											control={form.control}
											name="smtpHost"
											render={({ field }) => (
												<FormItem>
													<FormLabel>
														{t(
															"mailboxes.connectImapDialog.smtpHost",
														)}
													</FormLabel>
													<FormControl>
														<Input
															placeholder="smtp.yourdomain.com"
															{...field}
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>
									<FormField
										control={form.control}
										name="smtpPort"
										render={({ field }) => (
											<FormItem>
												<FormLabel>
													{t(
														"mailboxes.connectImapDialog.port",
													)}
												</FormLabel>
												<FormControl>
													<Input
														type="number"
														{...field}
														value={
															field.value as number
														}
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>
								</div>
								<FormField
									control={form.control}
									name="smtpSecure"
									render={({ field }) => (
										<FormItem className="flex items-center justify-between">
											<FormLabel className="font-normal">
												{t(
													"mailboxes.connectImapDialog.smtpSecure",
												)}
											</FormLabel>
											<FormControl>
												<Switch
													checked={field.value}
													onCheckedChange={
														field.onChange
													}
												/>
											</FormControl>
										</FormItem>
									)}
								/>

								<Button
									type="submit"
									className="w-full"
									loading={
										verifyImap.isPending ||
										form.formState.isSubmitting
									}
								>
									<MailIcon className="size-4" />
									{t("mailboxes.connectStandalone.submit")}
								</Button>
							</form>
						</Form>

						<p className="text-muted-foreground text-sm text-center">
							{t(
								"mailboxes.connectStandalone.preferOtherProvider",
							)}{" "}
							<Link
								href="/auth/signup"
								className="font-medium underline underline-offset-4 hover:text-foreground/70"
							>
								{t(
									"mailboxes.connectStandalone.useGmailOutlook",
								)}
							</Link>
						</p>
					</div>
				)}
			</div>
		</main>
	);
}
