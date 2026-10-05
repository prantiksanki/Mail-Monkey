"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { CheckCircleIcon, KeyIcon } from "lucide-react";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
	email: z.string().email(),
});

export function Newsletter() {
	const t = useTranslations();
	const newsletterSignupMutation = useMutation(
		orpc.newsletter.subscribe.mutationOptions(),
	);

	const form = useForm({
		resolver: zodResolver(formSchema),
	});

	const onSubmit = form.handleSubmit(async ({ email }) => {
		try {
			await newsletterSignupMutation.mutateAsync({ email });
		} catch {
			form.setError("email", {
				message: t("newsletter.hints.error.message"),
			});
		}
	});

	return (
		<section className="py-16 lg:py-20 xl:py-24">
			<div className="container max-w-3xl">
				<div className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)] lg:p-8">
					<div className="mb-8 text-center">
						<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-muted text-foreground">
							<KeyIcon className="size-5" />
						</div>
						<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-foreground">
							Newsletter
						</p>
						<h1 className="font-serif text-xl font-normal leading-tight text-foreground md:text-2xl lg:text-3xl xl:text-4xl">
							{t("newsletter.title")}
						</h1>
						<p className="mt-3 text-sm text-foreground sm:text-base">
							{t("newsletter.subtitle")}
						</p>
					</div>

					<div className="mx-auto max-w-lg">
						{form.formState.isSubmitSuccessful ? (
							<Alert variant="success">
								<CheckCircleIcon />
								<AlertTitle>
									{t("newsletter.hints.success.title")}
								</AlertTitle>
								<AlertDescription>
									{t("newsletter.hints.success.message")}
								</AlertDescription>
							</Alert>
						) : (
							<form onSubmit={onSubmit}>
								<div className="flex items-center gap-2">
									<Input
										type="email"
										required
										placeholder={t("newsletter.email")}
										{...form.register("email")}
									/>

									<Button
										type="submit"
										loading={form.formState.isSubmitting}
										className="border border-foreground bg-foreground text-background hover:bg-foreground/90"
									>
										{t("newsletter.submit")}
									</Button>
								</div>
								{form.formState.errors.email && (
									<p className="mt-1 text-destructive text-xs">
										{form.formState.errors.email.message}
									</p>
								)}
							</form>
						)}
					</div>
				</div>
			</div>
		</section>
	);
}
