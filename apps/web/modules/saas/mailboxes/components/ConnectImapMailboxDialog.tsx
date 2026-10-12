"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
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
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useConnectImapMailboxMutation } from "../lib/api";

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

interface ConnectImapMailboxDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConnected: () => void;
}

export function ConnectImapMailboxDialog({
	open,
	onOpenChange,
	onConnected,
}: ConnectImapMailboxDialogProps) {
	const t = useTranslations();
	const connectImap = useConnectImapMailboxMutation();

	const form = useForm({
		resolver: zodResolver(formSchema),
		defaultValues: {
			email: "",
			password: "",
			imapHost: "",
			imapPort: 993,
			imapSecure: true,
			smtpHost: "",
			smtpPort: 465,
			smtpSecure: true,
		},
	});

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			await connectImap.mutateAsync(values);
			toast.success(
				t("mailboxes.connectImapDialog.success", {
					email: values.email,
				}),
			);
			form.reset();
			onOpenChange(false);
			onConnected();
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: t("mailboxes.connectImapDialog.error"),
			);
		}
	});

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) {
					form.reset();
				}
				onOpenChange(next);
			}}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>
						{t("mailboxes.connectImapDialog.title")}
					</DialogTitle>
					<DialogDescription>
						{t("mailboxes.connectImapDialog.description")}
					</DialogDescription>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={onSubmit} className="space-y-4">
						<FormField
							control={form.control}
							name="email"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("mailboxes.connectImapDialog.email")}
									</FormLabel>
									<FormControl>
										<Input
											type="email"
											autoComplete="email"
											placeholder="support@yourdomain.com"
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
													placeholder="imap.example.com"
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
												value={field.value as number}
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
											onCheckedChange={field.onChange}
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
													placeholder="smtp.example.com"
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
												value={field.value as number}
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
											onCheckedChange={field.onChange}
										/>
									</FormControl>
								</FormItem>
							)}
						/>

						<DialogFooter>
							<Button
								type="button"
								variant="ghost"
								onClick={() => onOpenChange(false)}
							>
								{t("mailboxes.connectImapDialog.cancel")}
							</Button>
							<Button
								type="submit"
								loading={connectImap.isPending}
							>
								{t("mailboxes.connectImapDialog.connect")}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
