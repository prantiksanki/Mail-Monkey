import { cn } from "@repo/ui";
import { Check, Clock } from "lucide-react";
import Image from "next/image";

const badges = [
	{
		label: "CASA Tier 2 Validated",
		src: "/images/compliance/casa-tier-2.webp",
		pending: false,
	},
	{
		label: "GDPR",
		src: "/images/compliance/gdpr.png",
		pending: false,
	},
	{
		label: "CCPA",
		src: "/images/compliance/ccpa.webp",
		pending: false,
	},
	{
		label: "SOC 2",
		src: "/images/compliance/soc2.png",
		pending: true,
		note: "Type 2 in progress",
	},
	{
		label: "Google OAuth Verified",
		src: "/images/compliance/google-oauth.png",
		pending: false,
	},
] as const;

export function SecurityCompliance() {
	return (
		<section className="bg-background">
			<div className="rounded-[40px] bg-[#0663DA] px-6 py-16 text-white sm:px-8 sm:py-20 lg:px-10">
				<div className="mx-auto w-full max-w-7xl">
					<div className="mb-12 text-center">
						<span className="mb-3 inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 font-semibold text-[11px] text-white/80 uppercase tracking-[0.12em]">
							Trust &amp; Security
						</span>
						<h2 className="font-semibold text-3xl tracking-tight sm:text-4xl">
							Security and compliance
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-base text-white/70">
							Independently assessed against the App Defense
							Alliance CASA framework.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
						{badges.map((badge) => (
							<div
								key={badge.label}
								className={cn(
									"group flex flex-col items-center gap-4 rounded-[28px] border bg-[#00388F] px-5 py-8 text-center transition duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_18px_40px_-18px_rgba(0,0,0,0.5)]",
									badge.pending
										? "border-white/30 border-dashed"
										: "border-white/10",
								)}
							>
								<div className="flex size-28 items-center justify-center">
									<Image
										src={badge.src}
										alt={`${badge.label} badge`}
										width={112}
										height={112}
										className="size-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)] transition duration-300 group-hover:scale-105"
									/>
								</div>
								<span
									className={cn(
										"flex size-6 items-center justify-center rounded-full",
										badge.pending
											? "bg-white/10 text-white/80"
											: "bg-lime-300 text-[#00388F]",
									)}
								>
									{badge.pending ? (
										<Clock className="size-3.5" />
									) : (
										<Check
											className="size-3.5"
											strokeWidth={3}
										/>
									)}
								</span>
								<p className="font-semibold text-base text-white">
									{badge.label}
								</p>
								{"note" in badge && (
									<span className="rounded-full border border-white/30 px-3 py-1 text-white/80 text-xs">
										{badge.note}
									</span>
								)}
							</div>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
