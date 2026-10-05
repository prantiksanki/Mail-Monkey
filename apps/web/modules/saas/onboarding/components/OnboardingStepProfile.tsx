"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import {
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatarUpload } from "@saas/settings/components/UserAvatarUpload";
import { ArrowRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
	name: z.string().min(1),
});

export function OnboardingStepProfile({
	onCompleted,
}: {
	onCompleted: () => void;
}) {
	const t = useTranslations();
	const { user } = useSession();

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: { name: user?.name ?? "" },
	});

	useEffect(() => {
		if (user) {
			form.setValue("name", user.name ?? "");
		}
	}, [user]);

	const onSubmit = form.handleSubmit(async ({ name }) => {
		form.clearErrors("root");
		try {
			if (name !== user?.name) {
				await authClient.updateUser({ name });
			}
			onCompleted();
		} catch {
			form.setError("root", {
				type: "server",
				message: t("onboarding.notifications.accountSetupFailed"),
			});
		}
	});

	return (
		<div>
			<p className="font-mono text-foreground/50 text-xs uppercase tracking-wider">
				{t("onboarding.profile.eyebrow")}
			</p>
			<h1 className="mt-3 text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{t.rich("onboarding.profile.heading", {
					accent: (chunks) => (
						<em className="italic text-primary">{chunks}</em>
					),
				})}
			</h1>
			<p className="mt-4 max-w-lg text-foreground/60">
				{t("onboarding.profile.description")}
			</p>

			<Form {...form}>
				<form
					className="mt-8 flex flex-col items-stretch gap-6"
					onSubmit={onSubmit}
				>
					<FormField
						control={form.control}
						name="name"
						render={({ field }) => (
							<FormItem>
								<FormLabel>
									{t("onboarding.account.name")}
								</FormLabel>
								<FormControl>
									<Input {...field} />
								</FormControl>
							</FormItem>
						)}
					/>

					<FormItem className="flex items-center justify-between gap-4">
						<div>
							<FormLabel>
								{t("onboarding.account.avatar")}
							</FormLabel>
							<FormDescription>
								{t("onboarding.account.avatarDescription")}
							</FormDescription>
						</div>
						<FormControl>
							<UserAvatarUpload
								onSuccess={() => {
									return;
								}}
								onError={() => {
									return;
								}}
							/>
						</FormControl>
					</FormItem>

					<Button
						type="submit"
						loading={form.formState.isSubmitting}
						className="self-start"
					>
						{t("onboarding.profile.continue")}
						<ArrowRightIcon className="ml-2 size-4" />
					</Button>
				</form>
			</Form>
		</div>
	);
}
