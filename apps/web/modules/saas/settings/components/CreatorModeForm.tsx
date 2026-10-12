"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { updateCreatorProfileSchema } from "@repo/api/modules/creator-profiles/types";
import { authClient } from "@repo/auth/client";
import { Button } from "@repo/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Switch } from "@repo/ui/components/switch";
import { useSession } from "@saas/auth/hooks/use-session";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

type AccountType = "STANDARD" | "FREELANCER" | "CREATOR";

export function CreatorModeForm() {
	const { user, reloadSession } = useSession();
	const t = useTranslations();

	const accountType = (user?.accountType as AccountType) ?? "STANDARD";
	const isProfileEligible = accountType !== "STANDARD";

	const profileQuery = useQuery({
		...orpc.creatorProfiles.me.queryOptions(),
		enabled: isProfileEligible,
	});

	const accountTypeMutation = useMutation({
		mutationFn: async (value: AccountType) => {
			const { error } = await authClient.updateUser({
				accountType: value,
			});
			if (error) {
				throw new Error(error.message);
			}
			await reloadSession();
		},
		onSuccess: () => {
			toast.success(
				t("settings.account.creatorMode.notifications.success"),
			);
		},
		onError: () => {
			toast.error(t("settings.account.creatorMode.notifications.error"));
		},
	});

	const form = useForm({
		resolver: zodResolver(updateCreatorProfileSchema),
		defaultValues: { bio: "", links: [], enabled: false },
	});

	useEffect(() => {
		if (profileQuery.data) {
			form.reset(profileQuery.data);
		}
	}, [profileQuery.data, form]);

	const profileMutation = useMutation(
		orpc.creatorProfiles.update.mutationOptions(),
	);

	const onSubmit = form.handleSubmit(async (values) => {
		try {
			await profileMutation.mutateAsync(values);
			toast.success(
				t("settings.account.creatorMode.notifications.success"),
			);
		} catch {
			toast.error(t("settings.account.creatorMode.notifications.error"));
		}
	});

	return (
		<SettingsItem
			title={t("settings.account.creatorMode.title")}
			description={t("settings.account.creatorMode.description")}
		>
			<div className="flex flex-col gap-6">
				<Select
					value={accountType}
					onValueChange={(value) =>
						accountTypeMutation.mutate(value as AccountType)
					}
					disabled={accountTypeMutation.isPending}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="STANDARD">
							{t("settings.account.creatorMode.types.standard")}
						</SelectItem>
						<SelectItem value="FREELANCER">
							{t("settings.account.creatorMode.types.freelancer")}
						</SelectItem>
						<SelectItem value="CREATOR">
							{t("settings.account.creatorMode.types.creator")}
						</SelectItem>
					</SelectContent>
				</Select>

				{isProfileEligible && (
					<form onSubmit={onSubmit} className="flex flex-col gap-4">
						<div className="flex items-center justify-between gap-4">
							<div>
								<p className="font-medium text-sm">
									{t("settings.account.creatorMode.enable")}
								</p>
								{user?.username && (
									<p className="text-foreground/60 text-sm">
										{t(
											"settings.account.creatorMode.publicUrl",
										)}{" "}
										<Link
											href={`/u/${user.username}`}
											className="underline underline-offset-2"
											target="_blank"
										>
											/u/{user.username}
										</Link>
									</p>
								)}
							</div>
							<Switch
								checked={form.watch("enabled")}
								onCheckedChange={(checked) =>
									form.setValue("enabled", checked, {
										shouldDirty: true,
									})
								}
							/>
						</div>

						<div className="flex justify-end">
							<Button
								type="submit"
								loading={form.formState.isSubmitting}
								disabled={!form.formState.isDirty}
							>
								{t("settings.save")}
							</Button>
						</div>
					</form>
				)}
			</div>
		</SettingsItem>
	);
}
