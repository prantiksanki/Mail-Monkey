import type { config } from "@repo/payments/config";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type ProductReferenceId = keyof typeof config.plans;

export function usePlanData() {
	const t = useTranslations();

	const planData: Record<
		ProductReferenceId,
		{
			title: string;
			description: ReactNode;
			features: ReactNode[];
		}
	> = {
		free: {
			title: t("pricing.products.free.title"),
			description: t("pricing.products.free.description"),
			features: [
				t("pricing.products.free.features.mailboxes"),
				t("pricing.products.free.features.templates"),
				t("pricing.products.free.features.community"),
			],
		},
		pro: {
			title: t("pricing.products.pro.title"),
			description: t("pricing.products.pro.description"),
			features: [
				t("pricing.products.pro.features.mailboxes"),
				t("pricing.products.pro.features.rulesPerMailbox"),
				t("pricing.products.pro.features.emailsPerMonth"),
				t("pricing.products.pro.features.inboxIntelligence"),
				t("pricing.products.pro.features.aiRulesAssistant"),
				t("pricing.products.pro.features.automationAnalytics"),
				t("pricing.products.pro.features.ruleEngine"),
				t("pricing.products.pro.features.prioritySupport"),
			],
		},
	};

	return { planData };
}
