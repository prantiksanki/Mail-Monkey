import { Brain, Instagram, Mail, Twitter } from "lucide-react";
import Link from "next/link";
import { LocaleLink } from "@/modules/i18n/routing";
import { AiProviderButtons } from "./AiProviderButtons";

const footerLinks = [
	{ label: "Products", href: "/#pricing" },
	{ label: "About", href: "/about" },
	{ label: "Blog", href: "/blog" },
	{ label: "Contact Us", href: "/contact" },
] as const;

const legalLinks = [
	{ label: "Privacy", href: "/legal/privacy-policy" },
	{ label: "Terms", href: "/legal/terms" },
] as const;

export function Footer() {
	return (
		<footer className="border-white/10 border-t bg-black">
			<div className="mx-auto grid w-full max-w-7xl gap-6 px-6 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
				<div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-8 text-white">
					<div className="flex items-start justify-between gap-4">
						<div className="space-y-6">
							<p className="font-semibold text-sm uppercase tracking-[0.2em] text-lime-300/80">
								Explore AI Summary
							</p>
							<h3 className="max-w-sm font-semibold text-3xl leading-tight tracking-tight text-white">
								Ask AI about Zer0Email
							</h3>
							<AiProviderButtons />
						</div>
					</div>
				</div>

				<div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-8 py-8 text-white">
					<div className="max-w-sm space-y-6">
						<p className="font-medium text-sm uppercase tracking-[0.2em] text-white/45">
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
								className="h-12 w-full border-0 border-b border-white/20 bg-transparent px-0 text-lg text-white outline-none placeholder:text-white/30 focus:border-white/50"
							/>
							<button
								type="submit"
								className="inline-flex items-center justify-center border-0 bg-transparent px-0 font-semibold text-sm uppercase tracking-[0.24em] text-white/70 transition hover:text-white"
							>
								Subscribe
							</button>
						</form>
					</div>
				</div>
			</div>

			<div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-12 sm:px-8 lg:grid-cols-[1.2fr_0.9fr_0.8fr] lg:px-10">
				<div className="space-y-5">
					<h3 className="font-semibold text-white text-3xl tracking-tight">
						Zer0Email
					</h3>
					<p className="max-w-sm text-base leading-8 text-white/45">
						Empowering businesses with intelligent email solutions,
						designed for the future of work.
					</p>
				</div>

				<div className="space-y-5">
					<h4 className="font-semibold text-white text-lg">
						Useful Link
					</h4>
					<ul className="space-y-4 text-base text-white/45">
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
					<h4 className="font-semibold text-white text-lg">
						Follow Us
					</h4>
					<div className="flex flex-col gap-4 text-base text-white/45">
						<Link
							href="https://x.com"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-3 transition hover:text-white"
						>
							<Twitter className="size-4" />
							<span>Twitter (X)</span>
						</Link>
						<Link
							href="https://instagram.com"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-3 transition hover:text-white"
						>
							<Instagram className="size-4" />
							<span>Instagram</span>
						</Link>
					</div>

					<div className="pt-2">
						<a
							href="https://www.producthunt.com/products/zer0-email/reviews/new?utm_source=badge-product_review&utm_medium=badge&utm_source=badge-zer0&#0045;email"
							target="_blank"
							rel="noreferrer"
						>
							{/* biome-ignore lint/performance/noImgElement: external Product Hunt badge SVG */}
							<img
								src="https://api.producthunt.com/widgets/embed-image/v1/product_review.svg?product_id=1217697&theme=dark"
								alt="Zer0 Email - AI inbox automation for Gmail and Outlook | Product Hunt"
								width={250}
								height={54}
								style={{ width: "250px", height: "54px" }}
							/>
						</a>
					</div>
				</div>
			</div>

			<div className="border-white/10 border-t">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6 text-sm text-white/45 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.05] text-white">
							<Brain className="size-4" />
						</div>
						<p>Copyright © 2026 Zer0Email. All rights reserved.</p>
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
						<Link
							href="mailto:founder@zer0email.com"
							className="inline-flex items-center gap-2 transition hover:text-white"
						>
							<Mail className="size-4" />
							<span>founder@zer0email.com</span>
						</Link>
					</div>
				</div>
			</div>
		</footer>
	);
}
