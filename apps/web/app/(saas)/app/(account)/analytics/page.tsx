import { AnalyticsDashboard } from "@saas/analytics/components/AnalyticsDashboard";
import { PageHeader } from "@saas/shared/components/PageHeader";
import { getTranslations } from "next-intl/server";

export default async function AnalyticsPage() {
	const t = await getTranslations();

	return (
		<>
			<PageHeader
				title={t("analytics.title")}
				subtitle={t("analytics.subtitle")}
			/>
			<AnalyticsDashboard />
		</>
	);
}
