import { Brain } from "lucide-react";
import { LocaleLink } from "@/modules/i18n/routing";
import { FollowUsDock } from "./FollowUsDock";

const footerLinks = [
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
			<div className="mx-auto grid w-full max-w-7xl gap-12 px-6 py-12 sm:px-8 lg:grid-cols-[1.2fr_0.9fr_0.8fr] lg:px-10">
				<div className="space-y-5">
					<h3 className="font-semibold text-3xl text-white tracking-tight">
						Mail Monkey
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
				</div>
			</div>

			<div className="border-white/15 border-t">
				<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-6 text-sm text-white/70 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
					<div className="flex items-center gap-3">
						<div className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white">
							<Brain className="size-4" />
						</div>
						<p>
							Copyright © 2026 Mail Monkey. All rights reserved.
						</p>
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
					</div>
				</div>
			</div>
		</footer>
	);
}
