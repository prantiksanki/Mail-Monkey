"use client";

import type {
	MediaKitCollaboration,
	MediaKitRateCardItem,
	MediaKitStat,
} from "@repo/api/modules/creator-profiles/types";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Switch } from "@repo/ui/components/switch";
import { useSession } from "@saas/auth/hooks/use-session";
import { SettingsItem } from "@saas/shared/components/SettingsItem";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

function RowEditor<T extends Record<string, string | undefined>>({
	rows,
	fields,
	onChange,
	addLabel,
}: {
	rows: T[];
	fields: { key: keyof T; placeholder: string }[];
	onChange: (rows: T[]) => void;
	addLabel: string;
}) {
	return (
		<div className="flex flex-col gap-2">
			{rows.map((row, index) => (
				<div key={index} className="flex items-center gap-2">
					{fields.map((field) => (
						<Input
							key={String(field.key)}
							value={row[field.key] ?? ""}
							placeholder={field.placeholder}
							onChange={(e) => {
								const next = [...rows];
								next[index] = {
									...next[index],
									[field.key]: e.target.value,
								};
								onChange(next);
							}}
						/>
					))}
					<button
						type="button"
						onClick={() =>
							onChange(rows.filter((_, i) => i !== index))
						}
						className="text-foreground/40 hover:text-destructive"
					>
						<XIcon className="size-4" />
					</button>
				</div>
			))}
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="w-fit"
				onClick={() => onChange([...rows, {} as T])}
			>
				<PlusIcon className="size-3.5" />
				{addLabel}
			</Button>
		</div>
	);
}

export function MediaKitForm() {
	const { user } = useSession();
	const t = useTranslations();

	const isCreator = user?.accountType === "CREATOR";

	const profileQuery = useQuery({
		...orpc.creatorProfiles.me.queryOptions(),
		enabled: isCreator,
	});

	const [mediaKitEnabled, setMediaKitEnabled] = useState(false);
	const [stats, setStats] = useState<MediaKitStat[]>([]);
	const [collaborations, setCollaborations] = useState<
		MediaKitCollaboration[]
	>([]);
	const [rateCard, setRateCard] = useState<MediaKitRateCardItem[]>([]);

	useEffect(() => {
		if (profileQuery.data) {
			setMediaKitEnabled(profileQuery.data.mediaKitEnabled);
			setStats(profileQuery.data.mediaKit.stats ?? []);
			setCollaborations(profileQuery.data.mediaKit.collaborations ?? []);
			setRateCard(profileQuery.data.mediaKit.rateCard ?? []);
		}
	}, [profileQuery.data]);

	const saveMutation = useMutation(
		orpc.creatorProfiles.updateMediaKit.mutationOptions(),
	);

	const onSave = async () => {
		try {
			await saveMutation.mutateAsync({
				mediaKitEnabled,
				mediaKit: {
					stats: stats.filter((s) => s.label && s.value),
					collaborations: collaborations.filter((c) => c.label),
					rateCard: rateCard.filter((r) => r.label && r.price),
				},
			});
			toast.success(t("settings.account.mediaKit.notifications.success"));
		} catch {
			toast.error(t("settings.account.mediaKit.notifications.error"));
		}
	};

	if (!isCreator) {
		return null;
	}

	return (
		<SettingsItem
			title={t("settings.account.mediaKit.title")}
			description={t("settings.account.mediaKit.description")}
		>
			<div className="flex flex-col gap-6">
				<div className="flex items-center justify-between gap-4">
					<p className="font-medium text-sm">
						{t("settings.account.mediaKit.enable")}
					</p>
					<Switch
						checked={mediaKitEnabled}
						onCheckedChange={setMediaKitEnabled}
					/>
				</div>

				<div>
					<p className="mb-2 font-medium text-sm">
						{t("settings.account.mediaKit.stats")}
					</p>
					<RowEditor
						rows={stats}
						fields={[
							{ key: "label", placeholder: "Followers" },
							{ key: "value", placeholder: "120K" },
						]}
						onChange={setStats}
						addLabel={t("settings.account.mediaKit.addStat")}
					/>
				</div>

				<div>
					<p className="mb-2 font-medium text-sm">
						{t("settings.account.mediaKit.collaborations")}
					</p>
					<RowEditor
						rows={collaborations}
						fields={[
							{ key: "label", placeholder: "Brand name" },
							{ key: "url", placeholder: "https://…" },
						]}
						onChange={setCollaborations}
						addLabel={t(
							"settings.account.mediaKit.addCollaboration",
						)}
					/>
				</div>

				<div>
					<p className="mb-2 font-medium text-sm">
						{t("settings.account.mediaKit.rateCard")}
					</p>
					<RowEditor
						rows={rateCard}
						fields={[
							{ key: "label", placeholder: "Instagram post" },
							{ key: "price", placeholder: "$500" },
						]}
						onChange={setRateCard}
						addLabel={t("settings.account.mediaKit.addRate")}
					/>
				</div>

				<div className="flex justify-end">
					<Button onClick={onSave} loading={saveMutation.isPending}>
						{t("settings.save")}
					</Button>
				</div>
			</div>
		</SettingsItem>
	);
}
