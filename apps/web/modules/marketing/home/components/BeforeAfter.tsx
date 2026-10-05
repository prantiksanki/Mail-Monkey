export function BeforeAfter() {
	return (
		<section className="w-full bg-background px-6 py-20 text-center sm:px-8 sm:py-24">
			<span className="mb-4 inline-block rounded-full bg-foreground px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-background">
				The transformation
			</span>
			<div className="mb-2 font-serif text-[34px] font-normal leading-[1.02] tracking-normal text-foreground sm:text-[40px] md:text-[52px]">
				Inbox, transformed.
			</div>
			<p className="mb-10 text-[18px] leading-[1.5] text-foreground">
				From chaos to calm — automatically.
			</p>

			<div className="mx-auto grid max-w-[900px] grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-border bg-border shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)] sm:grid-cols-2">
				<div className="bg-card p-8 text-left sm:p-10">
					<div className="mb-4 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
						<span className="size-2 rounded-full bg-foreground/40" />
						Before
					</div>
					<h3 className="mb-[0.6rem] font-serif text-[28px] font-normal tracking-normal text-foreground">
						Cluttered
					</h3>
					<p className="text-sm leading-[1.8] text-foreground">
						Newsletters, receipts, cold outreach, alerts. Multiple
						accounts open in separate tabs. Hours lost every week
						just triaging.
					</p>
				</div>
				<div className="bg-card p-8 text-left sm:p-10">
					<div className="mb-4 flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
						<span className="size-2 rounded-full bg-foreground" />
						After
					</div>
					<h3 className="mb-[0.6rem] font-serif text-[28px] font-normal tracking-normal text-foreground">
						Calm &amp; clear
					</h3>
					<p className="text-sm leading-[1.8] text-foreground">
						Every account unified. AI rules archive, label, and file
						everything. Your inbox is a quiet, intentional space.
					</p>
				</div>
			</div>
		</section>
	);
}
