"use client";

import { LocaleLink, useLocalePathname } from "@i18n/routing";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui/components/sheet";
import { useSession } from "@saas/auth/hooks/use-session";
import { motion } from "framer-motion";
import { MenuIcon } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useEffect, useState } from "react";
import { config } from "@/config";

const menuItems: { label: string; href: string }[] = [
	{ label: "Features", href: "/#features" },
	{ label: "Pricing", href: "/pricing" },
	{ label: "Blog", href: "/blog" },
	{ label: "About", href: "/about" },
];

function GmailIcon({ className }: { className?: string }) {
	return (
		<Image
			src="/images/gmail-logo.png"
			alt="Gmail"
			width={18}
			height={18}
			className={`${className ?? ""} object-contain`}
		/>
	);
}

function OutlookIcon({ className }: { className?: string }) {
	return (
		<Image
			src="/images/outlook-logo.png"
			alt="Outlook"
			width={18}
			height={18}
			className={`${className ?? ""} object-contain`}
		/>
	);
}

export function NavBar() {
	const { user } = useSession();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const localePathname = useLocalePathname();

	const isHomePage =
		localePathname === "/" || /^\/[a-z]{2}$/.test(localePathname);
	const isLegalPage =
		localePathname.includes("/legal") ||
		localePathname.includes("/privacy") ||
		localePathname.includes("/terms");

	useEffect(() => {
		setMobileMenuOpen(false);
	}, [localePathname]);

	useEffect(() => {
		const idx = menuItems.findIndex((item) =>
			localePathname === "/"
				? item.href === "/"
				: localePathname.includes(item.href.replace("/#", "/")),
		);
		setActiveIndex(idx >= 0 ? idx : null);
	}, [localePathname]);

	if (isLegalPage) {
		return null;
	}

	return (
		<div
			className="fixed top-0 left-0 right-0 z-50 bg-black px-6 pt-6"
			data-test="navigation"
			style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
		>
			<nav
				className={`mx-auto flex max-w-[82rem] items-center justify-between rounded-full border px-5 py-3 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.65)] backdrop-blur-2xl ${isHomePage ? "border-white/16 bg-white/[0.06] dark:bg-black/40" : "border-white/10 bg-[#111]"}`}
			>
				{/* Logo */}
				<LocaleLink
					href="/"
					className="flex shrink-0 items-center hover:no-underline"
				>
					<span className="text-[18px] font-extrabold tracking-[-0.03em] text-white">
						{config.appName}
					</span>
				</LocaleLink>

				{/* Desktop menu links with animated glow indicator */}
				<div className="relative hidden items-center gap-2 lg:flex">
					{menuItems.map((menuItem, index) => {
						const isActive = index === activeIndex;
						return (
							<div key={menuItem.label} className="relative">
								{isActive && (
									<motion.div
										layoutId="nav-glow"
										className="absolute inset-0 -z-10 rounded-full bg-white/10"
										transition={{
											type: "spring",
											stiffness: 500,
											damping: 30,
										}}
									/>
								)}
								<LocaleLink
									href={menuItem.href}
									onClick={() => setActiveIndex(index)}
									className={[
										"relative block rounded-full px-5 py-2 text-[12px] font-medium uppercase tracking-[0.16em] transition-colors hover:no-underline",
										isActive
											? "text-white"
											: "text-white/80 hover:text-white",
									].join(" ")}
									prefetch
								>
									{menuItem.label}
								</LocaleLink>
							</div>
						);
					})}
				</div>

				{/* CTA buttons + mobile trigger */}
				<div className="flex shrink-0 items-center gap-3">
					{user ? (
						<NextLink
							href="/app"
							className="hidden rounded-full bg-white px-5 py-2.5 text-[13px] font-bold text-[#1a1a1a] transition-colors hover:bg-white/90 lg:inline-flex"
						>
							Dashboard
						</NextLink>
					) : (
						<>
							<NextLink
								href="/auth/login"
								className="hidden rounded-full px-4 py-2.5 text-[13px] font-medium text-white/70 transition-colors hover:text-white lg:inline-flex"
							>
								Log In
							</NextLink>
							<NextLink
								href="/auth/signup"
								className="hidden items-center gap-2.5 rounded-full border border-white bg-white px-5 py-2.5 text-[13px] font-bold tracking-wide text-[#1a1a1a] transition-colors hover:bg-white/90 lg:inline-flex"
							>
								<GmailIcon className="size-[18px] shrink-0" />
								Gmail
							</NextLink>
							<NextLink
								href="/auth/signup"
								className="hidden items-center gap-2.5 rounded-full border border-white bg-white px-5 py-2.5 text-[13px] font-bold tracking-wide text-[#1a1a1a] transition-colors hover:bg-white/90 lg:inline-flex"
							>
								<OutlookIcon className="size-[18px] shrink-0" />
								Outlook
							</NextLink>
						</>
					)}

					{/* Mobile hamburger */}
					<Sheet
						open={mobileMenuOpen}
						onOpenChange={setMobileMenuOpen}
					>
						<SheetTrigger asChild>
							<button
								type="button"
								className="flex size-11 items-center justify-center rounded-full bg-white/12 text-white lg:hidden"
								aria-label="Menu"
							>
								<MenuIcon className="size-5" />
							</button>
						</SheetTrigger>
						<SheetContent
							className="w-[var(--sidebar-width)] border-[#2c3e5a]/15 bg-white text-[#1a2a3a]"
							side="right"
						>
							<SheetTitle className="text-[#1a2a3a]">
								Menu
							</SheetTitle>
							<div className="mt-4 flex flex-col items-start gap-1">
								{menuItems.map((menuItem) => (
									<LocaleLink
										key={menuItem.label}
										href={menuItem.href}
										onClick={() => setMobileMenuOpen(false)}
										className="block px-2 py-2 text-base font-medium text-[#1a2a3a]"
										prefetch
									>
										{menuItem.label}
									</LocaleLink>
								))}
								<NextLink
									href={user ? "/app" : "/auth/signup"}
									onClick={() => setMobileMenuOpen(false)}
									className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2c3e5a] px-4 py-3 text-sm font-bold text-white"
								>
									{user ? (
										"Dashboard"
									) : (
										<>
											<GmailIcon className="size-4" />
											Start with Gmail
										</>
									)}
								</NextLink>
							</div>
						</SheetContent>
					</Sheet>
				</div>
			</nav>
		</div>
	);
}
