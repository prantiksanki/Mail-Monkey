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

type PlanId = "free" | "pro";

type Row = {
	feature: string;
	values: Record<PlanId, ReactNode>;
};

function Check() {
	return <CheckIcon className="mx-auto size-4 text-emerald-400" />;
}

function Dash() {
	return <MinusIcon className="mx-auto size-4 text-white/40" />;
}

export function PricingCompare() {
	const t = useTranslations("pricing.compare");

	const rows: Row[] = [
		{
			feature: t("mailboxes"),
			values: { free: "1", pro: t("unlimited") },
		},
		{
			feature: t("rulesPerMailbox"),
			values: { free: "5", pro: t("unlimited") },
		},
		{
			feature: t("emailsProcessed"),
			values: { free: "100", pro: "10,000" },
		},
		{
			feature: t("ruleEngine"),
			values: { free: <Check />, pro: <Check /> },
		},
		{
			feature: t("aiAssistant"),
			values: { free: <Dash />, pro: <Check /> },
		},
		{
			feature: t("support"),
			values: {
				free: t("supportCommunity"),
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
							<TableHead className="text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
								{t("feature")}
							</TableHead>
							<TableHead className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
								{t("planFree")}
							</TableHead>
							<TableHead className="text-center text-[11px] font-medium uppercase tracking-[0.16em] text-white/50">
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
								<TableCell className="text-center text-sm text-white/70">
									{row.values.free}
								</TableCell>
								<TableCell className="text-center text-sm text-white/70">
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
