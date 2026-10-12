interface TestimonialItem {
	quote: string;
	initials: string;
	name: string;
	role: string;
}

const testimonials: TestimonialItem[] = [
	{
		quote: "First inbox tool I didn't abandon after a week. Trained it once. It's been quiet since.",
		initials: "MA",
		name: "Maya A.",
		role: "Founder",
	},
	{
		quote: "I manage 4 accounts. This is the only tool that makes multi-account actually usable.",
		initials: "RK",
		name: "Raj K.",
		role: "Operations Lead",
	},
	{
		quote: "Was paying $29/mo for something that did half of this. Switched and never looked back.",
		initials: "SL",
		name: "Sara L.",
		role: "Product Designer",
	},
];

export function Testimonial() {
	return (
		<section className="w-full bg-background px-6 py-20 text-center sm:px-8 sm:py-24">
			<span className="mb-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
				Testimonials
			</span>
			<div className="mb-2 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Loved by people
				<br />
				who get things done.
			</div>
			<p className="mx-auto max-w-2xl text-[18px] leading-[1.6] text-foreground">
				People stay because the product feels quieter, faster, and more
				useful after the first setup.
			</p>

			<div className="mx-auto mt-10 grid max-w-[980px] grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-border bg-border shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)] md:grid-cols-3">
				{testimonials.map((item) => (
					<div key={item.name} className="bg-card p-8 text-left">
						<div className="mb-4 font-mono text-[12px] tracking-[0.25em] text-foreground">
							★★★★★
						</div>
						<p className="mb-6 text-[16px] leading-[1.85] text-foreground">
							"{item.quote}"
						</p>
						<div className="flex items-center gap-[10px]">
							<div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[11px] font-semibold text-foreground">
								{item.initials}
							</div>
							<div>
								<div className="text-[13px] font-medium text-foreground">
									{item.name}
								</div>
								<div className="text-[12px] text-foreground/60">
									{item.role}
								</div>
							</div>
						</div>
					</div>
				))}
			</div>
		</section>
	);
}
