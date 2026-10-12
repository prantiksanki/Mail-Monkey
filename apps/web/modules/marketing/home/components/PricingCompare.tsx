import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@repo/ui/components/table";
import { CheckIcon, MinusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type PlanId = "starter" | "pro";

type Row = {
	feature: string;
	values: Record<PlanId, ReactNode>;
};

function Check() {
	return <CheckIcon className="mx-auto size-4 text-emerald-400" />;
}

function Dash() {
	return <MinusIcon className="mx-auto size-4 text-white/55" />;
}

export function PricingCompare() {
	const t = useTranslations("pricing.compare");

	const rows: Row[] = [
		{
			feature: t("mailboxes"),
			values: { starter: "3", pro: t("unlimited") },
		},
		{
			feature: t("rulesPerMailbox"),
			values: { starter: t("unlimited"), pro: t("unlimited") },
		},
		{
			feature: t("emailsProcessed"),
			values: { starter: "3,000", pro: "15,000" },
		},
		{
			feature: t("ruleEngine"),
			values: { starter: <Check />, pro: <Check /> },
		},
		{
			feature: t("aiAssistant"),
			values: { starter: <Check />, pro: <Check /> },
		},
		{
			feature: t("calendarScheduling"),
			values: { starter: <Dash />, pro: <Check /> },
		},
		{
			feature: t("voice"),
			values: { starter: <Dash />, pro: <Check /> },
		},
		{
			feature: t("support"),
			values: {
				starter: t("supportCommunity"),
				pro: t("supportPriority"),
			},
		},
	];

	return (
		<div className="mt-16 lg:mt-24">
			<h3 className="mb-6 text-center font-[family-name:var(--font-bricolage)] text-[clamp(2rem,5vw,3.5rem)] font-extrabold leading-[0.97] tracking-[-0.04em] text-white">
				{t.rich("title", {
					accent: (chunks) => (
						<span className="text-emerald-400">{chunks}</span>
					),
				})}
			</h3>
			<div className="rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03]">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
								{t("feature")}
							</TableHead>
							<TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
								{t("planStarter")}
							</TableHead>
							<TableHead className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
								{t("planPro")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.feature}>
								<TableCell className="text-sm font-medium text-white/85">
									{row.feature}
								</TableCell>
								<TableCell className="text-center text-sm font-medium text-white/85">
									{row.values.starter}
								</TableCell>
								<TableCell className="text-center text-sm font-medium text-white/85">
									{row.values.pro}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
