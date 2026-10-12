import type { FeatureDefinition } from "@marketing/features/lib/feature-config";
import Image from "next/image";

export function FeatureBanner({ feature }: { feature: FeatureDefinition }) {
	return (
		<section className="w-full bg-background px-6 pb-4 sm:px-8">
			<div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-border">
				<Image
					src={feature.bannerImage.src}
					alt={feature.bannerImage.alt}
					width={2000}
					height={900}
					sizes="(min-width: 1152px) 72rem, 100vw"
					className="h-[280px] w-full object-cover sm:h-[340px] lg:h-[420px]"
				/>
				<div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
				<div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
					<span className="mb-3 inline-block rounded-full bg-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.22em] text-white backdrop-blur-sm">
						{feature.benefitsEyebrow}
					</span>
					<h2 className="max-w-xl font-sans text-[26px] font-semibold leading-[1.15] tracking-tight text-white sm:text-[32px]">
						{feature.benefitsTitle}
					</h2>
				</div>
			</div>
		</section>
	);
}
