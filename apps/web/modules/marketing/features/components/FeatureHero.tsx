import type { FeatureDefinition } from "@marketing/features/lib/feature-config";
import { CheckCircleIcon } from "lucide-react";
import Image from "next/image";

export function FeatureHero({ feature }: { feature: FeatureDefinition }) {
	return (
		<section className="w-full bg-background px-6 pt-28 pb-16 sm:px-8 sm:pt-36 sm:pb-20">
			<div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
				<div className="flex flex-col">
					<span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
						{feature.eyebrow}
					</span>

					<h1 className="font-sans text-[40px] font-bold leading-[1.02] tracking-tight text-foreground sm:text-[52px] md:text-[58px]">
						{feature.title}
					</h1>

					<p className="mt-5 text-[18px] font-medium leading-[1.5] text-foreground">
						{feature.subtitle}
					</p>
					<p className="mt-2 max-w-md text-[16px] leading-[1.6] text-muted-foreground">
						{feature.description}
					</p>

					<ul className="mt-6 space-y-2.5">
						{feature.checklist.map((item) => (
							<li
								key={item}
								className="flex items-center gap-2.5 text-[14px] text-foreground"
							>
								<CheckCircleIcon className="size-4 shrink-0 text-primary" />
								{item}
							</li>
						))}
					</ul>
				</div>

				<div className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
					<div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-2xl" />
					<div className="overflow-hidden rounded-[2rem] border border-border shadow-[0_30px_80px_-30px_rgba(6,99,218,0.35)]">
						<Image
							src={feature.heroImage.src}
							alt={feature.heroImage.alt}
							width={1200}
							height={1400}
							sizes="(min-width: 1024px) 32rem, 100vw"
							className="h-[420px] w-full object-cover sm:h-[480px] lg:h-[560px]"
							priority
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
