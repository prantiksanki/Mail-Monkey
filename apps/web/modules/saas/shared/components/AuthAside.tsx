import { useTranslations } from "next-intl";

const STATS = [
	{ value: "2.8M", key: "emails" as const },
	{ value: "14,200", key: "rules" as const },
	{ value: "99.98%", key: "uptime" as const },
];

export function AuthAside() {
	const t = useTranslations("auth.aside");

	return (
		<aside className="hidden flex-1 flex-col justify-between border-l border-black/8 bg-black/[0.02] p-10 lg:flex dark:border-white/[0.08] dark:bg-white/[0.03] xl:p-14">
			<div>
				<span className="font-medium text-[11px] text-foreground/50 uppercase tracking-wider">
					{t("label")}
				</span>
				<p className="mt-5 max-w-md text-balance text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-foreground">
					{t.rich("quote", {
						accent: (chunks) => (
							<span className="text-primary">{chunks}</span>
						),
					})}
				</p>
				<div className="mt-6 flex items-center gap-3 text-foreground/60 text-sm">
					<span className="flex size-8 items-center justify-center rounded-full bg-primary-soft font-medium text-[11px] text-primary">
						MA
					</span>
					<span>
						{t("author")}
						<span className="text-foreground/40"> · </span>
						{t("role")}
					</span>
				</div>
			</div>

			<div className="mt-10 flex gap-10">
				{STATS.map((stat) => (
					<div key={stat.key}>
						<div className="text-4xl font-semibold leading-none tracking-[-0.04em] text-foreground">
							{stat.value}
						</div>
						<div className="mt-2 font-medium text-[11px] text-foreground/50 uppercase tracking-wider">
							{t(`stats.${stat.key}`)}
						</div>
					</div>
				))}
			</div>
		</aside>
	);
}
