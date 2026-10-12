import { ArrowRightIcon } from "lucide-react";
import NextLink from "next/link";

export function FinalCta() {
	return (
		<div className="w-full bg-background px-6 py-20 text-center sm:px-8 sm:py-24">
			<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
				Get started
			</p>
			<h2 className="mb-2 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Zero inbox.
				<br />
				For real this time.
			</h2>
			<p className="mb-8 text-[17px] text-muted-foreground">
				Free forever · no card required
			</p>
			<div className="flex justify-center">
				<NextLink
					href="/auth/signup"
					prefetch
					className="group inline-flex items-center gap-4 rounded-full bg-black py-2 pr-2 pl-8 text-[17px] font-semibold leading-none text-white shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 hover:bg-neutral-800"
				>
					Try now
					<span className="flex size-11 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:translate-x-1">
						<ArrowRightIcon className="size-5" />
					</span>
				</NextLink>
			</div>
		</div>
	);
}
