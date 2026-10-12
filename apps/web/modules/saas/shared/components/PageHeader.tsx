"use client";

export function PageHeader({
	title,
	subtitle,
}: {
	title: string;
	subtitle?: string;
}) {
	return (
		<div className="mb-8">
			<h2 className="text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{title}
			</h2>
			{subtitle && (
				<p className="mt-3 max-w-xl text-foreground text-sm">
					{subtitle}
				</p>
			)}
		</div>
	);
}
