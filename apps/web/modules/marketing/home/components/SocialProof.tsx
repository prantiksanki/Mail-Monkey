import { useTranslations } from "next-intl";

const logos = ["Stripe", "Linear", "Figma", "Vercel", "Notion", "Supabase"];
const logoRows = [logos, logos];

export function SocialProof() {
	const t = useTranslations("home.proof");

	return (
		<section className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
			<div className="container">
				<div className="rounded-[1.5rem] border border-white/[0.08] bg-white/[0.02] px-6 py-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.18)]">
					<div className="text-[10px] uppercase tracking-[0.22em] text-foreground">
						{t("label")}
					</div>
					<div className="relative mt-5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
						<div className="flex w-[200%] motion-safe:animate-[trusted-logo-marquee_18s_linear_infinite] motion-reduce:w-full">
							{logoRows.map((row, rowIndex) => (
								<div
									aria-hidden={rowIndex > 0}
									className={`${rowIndex > 0 ? "motion-reduce:hidden" : ""} flex min-w-[50%] shrink-0 items-center justify-around gap-8 px-4 text-sm font-semibold uppercase tracking-[0.08em] text-foreground/[0.46] motion-reduce:min-w-full sm:gap-10 sm:px-6 lg:gap-12`}
									key={`logo-row-${rowIndex}`}
								>
									{row.map((name) => (
										<span key={`${rowIndex}-${name}`}>
											{name}
										</span>
									))}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
