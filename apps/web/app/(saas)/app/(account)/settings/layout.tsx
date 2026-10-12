import { getSession } from "@saas/auth/lib/server";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { PropsWithChildren } from "react";
export default async function SettingsLayout({ children }: PropsWithChildren) {
	const t = await getTranslations();
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return (
		<>
			<PageHeader
				title={t("settings.account.title")}
				subtitle={t("settings.account.subtitle")}
			/>

			{children}
		</>
	);
}
