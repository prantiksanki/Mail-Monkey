import { CheckCircleIcon } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";

const REASSURANCE = [
	"Secure authentication",
	"We never store your Zoom password",
	"Disconnect anytime",
];

export function ZoomIntegrationFinalCta() {
	return (
		<div className="w-full bg-background px-6 py-20 text-center sm:px-8 sm:py-24">
			<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
				Get started
			</p>
			<h2 className="mb-8 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Ready to automate
				<br />
				your Zoom meetings?
			</h2>
			<div className="flex flex-wrap justify-center gap-3">
				<NextLink
					href="/auth/signup"
					prefetch
					className="inline-flex items-center gap-2.5 rounded-full border-2 border-border bg-[#0663DA] px-6 py-3 text-[15px] font-medium leading-none text-primary-foreground shadow-[2px_2px_0px_0px_#00388F] transition-all hover:translate-x-px hover:translate-y-px hover:bg-[#0663DA]/90 hover:shadow-[1px_1px_0px_0px_#00388F]"
				>
					<Image
						src="/images/zoom-logo.svg"
						alt="Zoom"
						width={16}
						height={16}
						className="shrink-0 object-contain"
					/>
					Connect Zoom
				</NextLink>
				<NextLink
					href="/auth/signup"
					prefetch
					className="inline-flex items-center gap-2.5 rounded-full border-2 border-border bg-[#152238] px-6 py-3 text-[15px] font-medium leading-none text-primary-foreground shadow-[2px_2px_0px_0px_#0F1827] transition-all hover:translate-x-px hover:translate-y-px hover:bg-[#152238]/90 hover:shadow-[1px_1px_0px_0px_#0F1827]"
				>
					Start free
				</NextLink>
			</div>

			<div className="mx-auto mt-12 border-t border-border pt-8">
				<p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
					Trusted by professionals
				</p>
				<ul className="flex flex-wrap justify-center gap-x-6 gap-y-2.5">
					{REASSURANCE.map((item) => (
						<li
							key={item}
							className="flex items-center gap-2 text-[13px] text-muted-foreground"
						>
							<CheckCircleIcon className="size-4 shrink-0 text-[#2D8CFF]" />
							{item}
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
