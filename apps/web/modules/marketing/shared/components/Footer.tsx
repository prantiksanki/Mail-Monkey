import { Brain } from "lucide-react";
import { LocaleLink } from "@/modules/i18n/routing";
import { AiProviderButtons } from "./AiProviderButtons";
import { FollowUsDock } from "./FollowUsDock";
import { FooterEmailCopy } from "./FooterEmailCopy";

const footerLinks = [
	{ label: "Zoom Integration", href: "/integrations/zoom" },
	{ label: "About", href: "/about" },
	{ label: "Blog", href: "/blog" },
	{ label: "Contact Us", href: "/contact" },
] as const;

const legalLinks = [
	{ label: "Privacy", href: "/legal/privacy-policy" },
	{ label: "Terms", href: "/legal/terms" },
	{ label: "Cookies", href: "/legal/cookie-policy" },
] as const;

export function Footer() {
	return (
		<footer className="rounded-t-[40px] bg-[#0663DA] text-white">
			<div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
				<div className="rounded-[28px] border border-white/10 bg-[#00388F] px-8 py-8">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-6">
							<p className="font-semibold text-sm uppercase tracking-[0.2em] text-lime-300">
								Explore AI Summary
							</p>
							<h3 className="max-w-sm font-semibold text-3xl leading-tight tracking-tight text-white">
								Ask AI about Popsuites
							</h3>
							<AiProviderButtons />
						</div>
					</div>
				</div>

				<div className="rounded-[28px] border border-white/10 bg-[#00388F] px-8 py-8">
					<div className="max-w-sm space-y-6">
						<p className="font-medium text-sm uppercase tracking-[0.2em] text-white/70">
							Stay Updated
						</p>
						<p className="text-[30px] leading-tight tracking-tight text-white">
							Get early access updates and insights on the future
							of intelligent email.
						</p>
						<form className="space-y-4">
							<input
								type="email"
								placeholder="Email address"
								className="h-12 w-full border-0 border-white/30 border-b bg-transparent px-0 text-lg text-white outline-none placeholder:text-white/50 focus:border-white"
							/>
							<button
								type="submit"
								className="inline-flex items-center justify-center border-0 bg-transparent px-0 font-semibold text-sm text-white/70 uppercase tracking-[0.24em] transition hover:text-white"
							>
								Subscribe
							</button>
						</form>
					</div>
				</div>
			</div>

			<div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-12 sm:px-8 lg:grid-cols-[1.2fr_0.9fr_0.8fr] lg:px-10">
				<div className="space-y-5">
					<h3 className="font-semibold text-3xl text-white tracking-tight">
						Popsuites
					</h3>
					<p className="max-w-sm text-base text-white/70 leading-8">
						Empowering businesses with intelligent email solutions,
						designed for the future of work.
					</p>
				</div>

				<div className="space-y-5">
					<h4 className="font-semibold text-lg text-white">
						Useful Link
					</h4>
					<ul className="space-y-4 text-base text-white/70">
						{footerLinks.map((link) => (
							<li key={link.label}>
								<LocaleLink
									href={link.href}
									className="transition hover:text-white"
								>
									{link.label}
								</LocaleLink>
							</li>
						))}
					</ul>
				</div>

				<div className="space-y-5">
					<h4 className="font-semibold text-lg text-white">
						Follow Us
					</h4>
					<FollowUsDock />

					<div className="pt-2">
						<a
							href="https://www.producthunt.com/products/zer0-email/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-zer0&#0045;email"
							target="_blank"
							rel="noreferrer"
						>
							{/* biome-ignore lint/performance/noImgElement: external Product Hunt badge SVG */}
							<img
								src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1217697&theme=light"
								alt="Zer0 Email - AI inbox automation for Gmail and Outlook | Product Hunt"
								width={250}
								height={54}
								style={{ width: "250px", height: "54px" }}
							/>
						</a>
					</div>
				</div>
			</div>

			<div className="border-white/15 border-t">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6 text-sm text-white/70 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
							<Brain className="size-4" />
						</div>
						<p>Copyright © 2026 Popsuites. All rights reserved.</p>
					</div>

					<div className="flex flex-wrap items-center gap-5">
						{legalLinks.map((link) => (
							<LocaleLink
								key={link.label}
								href={link.href}
								className="transition hover:text-white"
							>
								{link.label}
							</LocaleLink>
						))}
						{/* Opens the Enzuzo preference center (the banner script in
						    the root layout handles #manage_cookies). Also the CCPA
						    opt-out entry point, so keep it visible. */}
						<a
							href="#manage_cookies"
							className="transition hover:text-white"
						>
							Cookie Preferences
						</a>
						<FooterEmailCopy email="support@popsuites.ai" />
					</div>
				</div>
			</div>
		</footer>
	);
}
