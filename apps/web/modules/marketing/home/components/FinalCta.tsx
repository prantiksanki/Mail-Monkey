import Image from "next/image";
import NextLink from "next/link";

export function FinalCta() {
	return (
		<div className="w-full bg-black px-6 py-20 text-center sm:px-8 sm:py-24">
			<p className="mb-3 font-mono text-[11px] uppercase tracking-[0.32em] text-white/45">
				Get started
			</p>
			<h2 className="mb-2 font-serif text-[34px] font-normal leading-[1.02] tracking-tight text-white sm:text-[40px] md:text-[52px]">
				Zero inbox.
				<br />
				For real this time.
			</h2>
			<p className="mb-8 text-[17px] text-white/55">
				Free forever · no card required
			</p>
			<div className="flex flex-wrap justify-center gap-3">
				<NextLink
					href="/auth/signup"
					prefetch
					className="inline-flex items-center gap-2.5 rounded-full border border-white bg-white px-6 py-3 text-[15px] text-black"
				>
					<Image
						src="/images/gmail-logo.png"
						alt="Gmail"
						width={16}
						height={16}
						className="shrink-0 object-contain"
					/>
					Connect Gmail
				</NextLink>
				<NextLink
					href="/auth/signup"
					prefetch
					className="inline-flex items-center gap-2.5 rounded-full border border-white bg-white px-6 py-3 text-[15px] text-black transition-opacity hover:opacity-90"
				>
					<Image
						src="/images/outlook-logo.png"
						alt="Outlook"
						width={16}
						height={16}
						className="shrink-0 object-contain"
					/>
					Connect Outlook
				</NextLink>
			</div>
		</div>
	);
}
