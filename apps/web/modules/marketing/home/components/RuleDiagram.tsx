import { useTranslations } from "next-intl";

const incoming = [
	{ sender: "Figma Weekly", subj: "New in Figma, April digest" },
	{ sender: "Substack", subj: "Your Friday reading list is here" },
	{ sender: "Linear", subj: "Weekly product update" },
];

const archived = ["Newsletter", "Newsletter", "Newsletter"];

export function RuleDiagram() {
	const t = useTranslations("home.diagram");

	return (
		<section
			id="how-it-works"
			className="scroll-mt-20 hidden pb-12 lg:block lg:pb-16 xl:pb-24"
		>
			<div className="container">
				<div className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.03] p-12 shadow-[0_28px_100px_rgba(0,0,0,0.22)]">
					<div className="mb-8 flex items-center justify-between">
						<span className="font-semibold text-[10px] uppercase tracking-[0.12em] text-foreground">
							{t("header")}
						</span>
						<span className="font-mono text-foreground text-xs">
							<span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle shadow-[0_0_10px_var(--primary)]" />
							{t("live")}
						</span>
					</div>

					<div className="grid grid-cols-[1fr_80px_1.3fr_80px_1fr] items-center">
						{/* Incoming column */}
						<div className="flex flex-col gap-2">
							<span className="mb-1 font-semibold text-[10px] uppercase tracking-[0.12em] text-foreground">
								{t("incoming")}
							</span>
							{incoming.map((email) => (
								<div
									key={email.sender}
									className="rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs"
								>
									<div className="font-semibold tracking-[0.01em]">
										{email.sender}
									</div>
									<div className="truncate text-foreground text-[11px]">
										{email.subj}
									</div>
								</div>
							))}
						</div>

						{/* Arrow in */}
						<div
							className="flex items-center justify-center"
							aria-hidden="true"
						>
							<svg
								viewBox="0 0 80 2"
								preserveAspectRatio="none"
								className="h-[2px] w-full overflow-visible text-border-strong"
								aria-hidden="true"
							>
								<line
									x1="0"
									y1="1"
									x2="72"
									y2="1"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeDasharray="3 3"
								/>
								<polygon
									points="72,-3 80,1 72,5"
									fill="currentColor"
								/>
							</svg>
						</div>

						{/* Rule card */}
						<div className="rounded-[1.5rem] border border-primary/40 bg-black/20 p-5 text-sm shadow-[0_16px_44px_var(--primary-soft)]">
							<div className="mb-2.5 text-base font-semibold tracking-[-0.02em]">
								{t("ruleName")}
							</div>
							<div className="mb-2 rounded-xl bg-primary/10 px-3 py-2 font-mono text-[11px] text-foreground">
								<strong className="font-semibold text-primary">
									{t("when")}
								</strong>{" "}
								{t("whenValue")}
							</div>
							<div className="rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-[11px] text-foreground">
								<strong className="font-semibold text-primary">
									{t("then")}
								</strong>{" "}
								{t("thenValue")}
							</div>
						</div>

						{/* Arrow out */}
						<div
							className="flex items-center justify-center"
							aria-hidden="true"
						>
							<svg
								viewBox="0 0 80 2"
								preserveAspectRatio="none"
								className="h-[2px] w-full overflow-visible text-primary"
								aria-hidden="true"
							>
								<line
									x1="0"
									y1="1"
									x2="72"
									y2="1"
									stroke="currentColor"
									strokeWidth="1.5"
									strokeDasharray="6 6"
								/>
								<polygon
									points="72,-3 80,1 72,5"
									fill="currentColor"
								/>
							</svg>
						</div>

						{/* Archived column */}
						<div className="flex flex-col gap-2">
							<span className="mb-1 font-semibold text-[10px] uppercase tracking-[0.12em] text-foreground">
								{t("outgoing")}
							</span>
							{archived.map((label, i) => (
								<div
									key={`${label}-${i}`}
									className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 text-sm"
								>
									<span className="rounded-full bg-primary/10 px-2.5 py-1 font-medium text-[11px] text-primary">
										{label}
									</span>
									<span className="text-foreground text-xs">
										{t("archived")}
									</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
