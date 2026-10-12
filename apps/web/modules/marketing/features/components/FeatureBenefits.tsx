import {
	FEATURE_ICONS_BY_SLUG,
	type FeatureDefinition,
} from "@marketing/features/lib/feature-config";

export function FeatureBenefits({ feature }: { feature: FeatureDefinition }) {
	const icons = FEATURE_ICONS_BY_SLUG[feature.slug] ?? [];

	return (
		<section
			id="benefits"
			className="w-full scroll-mt-24 bg-gradient-to-b from-[#f6f9ff] to-background px-6 py-20 sm:px-8 sm:py-24"
		>
			<div className="mx-auto w-full max-w-5xl">
				<p className="mx-auto mb-16 max-w-xl text-center text-[16px] leading-[1.7] text-muted-foreground">
					{feature.benefitsIntro}
				</p>

				<div className="grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2">
					{feature.benefits.map((benefit, index) => (
						<div
							key={benefit.title}
							className="flex items-start gap-5"
						>
							<span className="relative flex size-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-primary via-primary to-primary-deep text-primary-foreground shadow-[0_12px_24px_-10px_rgba(6,99,218,0.55),inset_0_1px_0_rgba(255,255,255,0.35)]">
								{icons[index]}
							</span>
							<div>
								<h3 className="font-sans text-[18px] font-bold tracking-tight text-foreground">
									{benefit.title}
								</h3>
								<p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
									{benefit.description}
								</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
