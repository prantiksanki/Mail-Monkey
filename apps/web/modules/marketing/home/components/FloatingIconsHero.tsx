import NextLink from "next/link";
import { PopsuitesIntegrationsBeam } from "./PopsuitesIntegrationsBeam";

export function FloatingIconsHero() {
	return (
		<section className="w-full bg-background px-6 py-16 text-center sm:px-8 sm:py-20">
			<div className="mx-auto max-w-2xl">
				<h2 className="mb-4 font-sans text-[34px] font-normal leading-[1.05] tracking-normal text-foreground sm:text-[40px] md:text-[48px]">
					One inbox. Every integration.
				</h2>
				<p className="mb-8 text-[17px] leading-relaxed text-muted-foreground">
					Telegram, Google, Slack, Zoom, WhatsApp, Meet, HubSpot,
					Outlook, Teams — all connected, all in sync.
				</p>
				<NextLink
					href="/auth/signup"
					prefetch
					className="inline-flex items-center gap-2.5 rounded-full border-2 border-border bg-primary px-6 py-3 text-[15px] font-semibold text-primary-foreground shadow-[2px_2px_0px_0px_var(--primary-deep)] transition-all hover:translate-x-px hover:translate-y-px hover:bg-primary/90 hover:shadow-[1px_1px_0px_0px_var(--primary-deep)]"
				>
					Integrate now
				</NextLink>
			</div>

			<div className="mx-auto mt-14 max-w-[900px]">
				<PopsuitesIntegrationsBeam />
			</div>
		</section>
	);
}
