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
			title: t("pricing.products.starter.title"),
			description: t("pricing.products.starter.description"),
			features: [],
		},
		starter: {
			title: t("pricing.products.starter.title"),
			description: t("pricing.products.starter.description"),
			features: [
				t("pricing.products.starter.features.mailboxes"),
				t("pricing.products.starter.features.rulesPerMailbox"),
				t("pricing.products.starter.features.emailsPerMonth"),
				t("pricing.products.starter.features.aiChat"),
				t("pricing.products.starter.features.autoDrafts"),
				t("pricing.products.starter.features.noCalendar"),
			],
		},
		pro: {
			title: t("pricing.products.pro.title"),
			description: t("pricing.products.pro.description"),
			features: [
				t("pricing.products.pro.features.mailboxes"),
				t("pricing.products.pro.features.everythingInStarter"),
				t("pricing.products.pro.features.calendarScheduling"),
				t("pricing.products.pro.features.meetingIntegrations"),
				t("pricing.products.pro.features.voice"),
				t("pricing.products.pro.features.emailsPerMonth"),
				t("pricing.products.pro.features.prioritySupport"),
			],
		},
	};

	return { planData };
}
