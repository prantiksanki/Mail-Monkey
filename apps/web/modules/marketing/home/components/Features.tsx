import {
	LockKeyholeIcon,
	MailIcon,
	NewspaperIcon,
	PackageIcon,
	ReceiptIcon,
	ZapIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type FeatureKey = "ai" | "templates" | "custom";

type Feature = {
	key: FeatureKey;
	icon: ReactNode;
	illustration: ReactNode;
};

const features: Feature[] = [
	{
		key: "ai",
		icon: <ZapIcon className="size-4" />,
		illustration: (
			<div className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05] p-3 text-xs">
				<div className="mb-1 font-mono text-[9px] text-foreground">
					YOU
				</div>
				<div className="text-foreground">
					archive anything from Substack
				</div>
			</div>
		),
	},
	{
		key: "templates",
		icon: <LockKeyholeIcon className="size-4" />,
		illustration: (
			<div className="flex w-full flex-col gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.05] p-3 text-xs">
				<div className="flex items-center gap-2">
					<NewspaperIcon className="size-3.5 shrink-0 text-primary" />
					<span>Newsletters</span>
				</div>
				<div className="flex items-center gap-2">
					<PackageIcon className="size-3.5 shrink-0 text-primary" />
					<span>Shipping</span>
				</div>
				<div className="flex items-center gap-2">
					<ReceiptIcon className="size-3.5 shrink-0 text-primary" />
					<span>Receipts</span>
				</div>
			</div>
		),
	},
	{
		key: "custom",
		icon: <MailIcon className="size-4" />,
		illustration: (
			<div className="w-full rounded-xl border border-white/[0.1] bg-white/[0.05] p-3 font-mono text-[11px] leading-relaxed text-foreground">
				<div>
					<span className="font-semibold text-primary">when</span>{" "}
					from: *@stripe.com
				</div>
				<div>
					<span className="font-semibold text-primary">and</span>{" "}
					subject contains "receipt"
				</div>
				<div>
					<span className="font-semibold text-primary">then</span>{" "}
					label: Finance
				</div>
			</div>
		),
	},
];

export function Features() {
	const t = useTranslations("home.features");

	return (
		<section
			id="features"
			className="scroll-mt-20 border-t border-white/[0.06] py-20 lg:py-24 xl:py-28"
		>
			<div className="container">
				<div className="mb-10 text-center lg:mb-14">
					<h2 className="mx-auto max-w-4xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.04em] text-foreground md:text-5xl lg:text-6xl">
						{t.rich("title", {
							accent: (chunks) => (
								<span className="text-primary">{chunks}</span>
							),
						})}
					</h2>
					<p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-8 text-foreground">
						{t("description")}
					</p>
				</div>

				<div className="grid grid-cols-1 gap-5 md:grid-cols-3">
					{features.map((f) => (
						<article
							key={f.key}
							className="flex min-h-[19rem] flex-col rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] p-6 shadow-[0_22px_80px_rgba(0,0,0,0.22)] lg:p-7"
						>
							<div className="flex size-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
								{f.icon}
							</div>
							<h3 className="mt-6 mb-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">
								{t(`items.${f.key}.title`)}
							</h3>
							<p className="text-base leading-7 text-foreground">
								{t(`items.${f.key}.description`)}
							</p>
							<div className="mt-6 flex flex-1 items-center justify-center rounded-[1.25rem] border border-white/[0.06] bg-black/20 p-4">
								{f.illustration}
							</div>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
