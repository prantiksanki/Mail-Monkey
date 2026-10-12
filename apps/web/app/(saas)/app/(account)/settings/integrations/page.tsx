import { getSession } from "@saas/auth/lib/server";
import { IntegrationsSettings } from "@saas/settings/components/IntegrationsSettings";
import { SettingsList } from "@saas/shared/components/SettingsList";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("settings.menu.account.integrations"),
	};
}

export default async function IntegrationsSettingsPage() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return (
		<SettingsList>
			<IntegrationsSettings />
		</SettingsList>
	);
}
