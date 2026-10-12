"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { publicProfileContactFormSchema } from "@repo/api/modules/creator-profiles/types";
import { Alert, AlertTitle } from "@repo/ui/components/alert";
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
import { Textarea } from "@repo/ui/components/textarea";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import { MailCheckIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

export function ProfileContactForm({ username }: { username: string }) {
	const t = useTranslations();
	const contactFormMutation = useMutation(
		orpc.creatorProfiles.submitContactForm.mutationOptions(),
	);

	const form = useForm({
		resolver: zodResolver(publicProfileContactFormSchema),
		defaultValues: {
			username,
			name: "",
			email: "",
			message: "",
		},
	});

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			await contactFormMutation.mutateAsync(values);
		} catch {
			form.setError("root", {
				message: t("profile.contactForm.notifications.error"),
			});
		}
	});

	if (form.formState.isSubmitSuccessful) {
		return (
			<Alert variant="success">
				<MailCheckIcon />
				<AlertTitle>
					{t("profile.contactForm.notifications.success")}
				</AlertTitle>
			</Alert>
		);
	}

	return (
		<Form {...form}>
			{/* method="post" so the no-JS fallback submission never puts the
			    email/message in the URL query string. */}
			<form
				method="post"
				onSubmit={onSubmit}
				className="flex flex-col items-stretch gap-4"
			>
				{form.formState.errors.root?.message && (
					<Alert variant="error">
						<MailIcon />
						<AlertTitle>
							{form.formState.errors.root.message}
						</AlertTitle>
					</Alert>
				)}

				<FormField
					control={form.control}
					name="name"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("profile.contactForm.name")}
							</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="email"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("profile.contactForm.email")}
							</FormLabel>
							<FormControl>
								<Input {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="message"
					render={({ field }) => (
						<FormItem>
							<FormLabel>
								{t("profile.contactForm.message")}
							</FormLabel>
							<FormControl>
								<Textarea {...field} />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<Button
					type="submit"
					className="w-full"
					variant="primary"
					loading={form.formState.isSubmitting}
				>
					{t("profile.contactForm.submit")}
				</Button>
			</form>
		</Form>
	);
}
