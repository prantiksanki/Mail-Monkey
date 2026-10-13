"use client";

import { LocaleLink, useLocalePathname } from "@i18n/routing";
import { Logo } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@repo/ui/components/sheet";
import { useSession } from "@saas/auth/hooks/use-session";
import { motion } from "framer-motion";
import { ChevronDownIcon, MenuIcon } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useEffect, useState } from "react";

interface IntegrationLink {
	label: string;
	href: string;
	description: string;
	icon: string;
}

interface MenuItem {
	label: string;
	href: string;
	children?: IntegrationLink[];
}

// Add a new integration by appending an entry to `children` below.
const menuItems: MenuItem[] = [
	{ label: "Features", href: "/#features" },
	{
		label: "Integrations",
		href: "/integrations/zoom",
		children: [
			{
				label: "Zoom",
				href: "/integrations/zoom",
				description: "Instant meeting links on every booking",
				icon: "/images/zoom-logo.svg",
			},
		],
	},
	{ label: "Blog", href: "/blog" },
	{ label: "About", href: "/about" },
];

export function NavBar() {
	const { user } = useSession();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState<number | null>(null);
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
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
			className="fixed top-0 left-0 right-0 z-50 bg-background px-6 pt-6"
			data-test="navigation"
			style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
		>
			<nav
				className={`relative mx-auto flex max-w-[82rem] items-center rounded-full border px-5 py-3 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.12)] backdrop-blur-2xl ${isHomePage ? "border-border bg-background/80" : "border-border bg-card"}`}
			>
				{/* Logo */}
				<LocaleLink
					href="/"
					className="flex shrink-0 items-center gap-2 leading-none hover:no-underline"
				>
					<Logo className="h-9" />
				</LocaleLink>

				{/* Right-hand cluster: nav links + CTA buttons + mobile trigger, grouped and pushed to the right */}
				<div className="ml-auto flex items-center gap-6 lg:gap-8">
					{/* Desktop menu links with animated glow indicator */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: hover tracking only, links inside remain keyboard-accessible */}
					<div
						className="hidden items-center gap-2 lg:flex"
						onMouseLeave={() => setHoveredIndex(null)}
					>
						{menuItems.map((menuItem, index) => {
							const isHighlighted =
								index === (hoveredIndex ?? activeIndex);
							const isDropdownOpen =
								menuItem.children != null &&
								hoveredIndex === index;
							return (
								// biome-ignore lint/a11y/noStaticElementInteractions: hover tracking only, link inside remains keyboard-accessible
								<div
									key={menuItem.label}
									className="relative"
									onMouseEnter={() => setHoveredIndex(index)}
									onMouseLeave={() => setHoveredIndex(null)}
								>
									{isHighlighted && (
										<motion.div
											layoutId="nav-glow"
											className="absolute inset-0 -z-10 rounded-full bg-muted"
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
										className="relative flex items-center gap-1.5 rounded-full px-5 py-2 text-[12px] font-bold uppercase tracking-[0.16em] text-foreground transition-colors hover:no-underline"
										prefetch
									>
										{menuItem.label}
										{menuItem.children && (
											<ChevronDownIcon
												className={`size-3.5 transition-transform ${
													isDropdownOpen
														? "rotate-180"
														: ""
												}`}
											/>
										)}
									</LocaleLink>

									{menuItem.children && isDropdownOpen && (
										<div className="absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3">
											<div className="w-[320px] rounded-2xl border border-border bg-background p-2 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.25)]">
												<p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
													{menuItem.label}
												</p>
												{menuItem.children.map(
													(child) => (
														<LocaleLink
															key={child.label}
															href={child.href}
															onClick={() =>
																setActiveIndex(
																	index,
																)
															}
															className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted hover:no-underline"
															prefetch
														>
															<Image
																src={child.icon}
																alt=""
																width={22}
																height={22}
																className="mt-0.5 size-[22px] shrink-0 object-contain"
															/>
															<span className="flex flex-col">
																<span className="text-[13px] font-semibold normal-case tracking-normal text-foreground">
																	{
																		child.label
																	}
																</span>
																<span className="text-[12px] normal-case tracking-normal text-muted-foreground">
																	{
																		child.description
																	}
																</span>
															</span>
														</LocaleLink>
													),
												)}
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>

					{/* CTA buttons + mobile trigger */}
					<div className="flex shrink-0 items-center gap-3">
						{user ? (
							<NextLink
								href="/app"
								className="hidden rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background transition-colors hover:bg-foreground/90 lg:inline-flex"
							>
								Dashboard
							</NextLink>
						) : (
							<Button
								asChild
								variant="neoPrimary"
								size="md"
								className="hidden rounded-full bg-[#0663DA] text-[13px] font-bold tracking-wide shadow-[4px_4px_0px_0px_#00388F] hover:bg-[#0663DA]/90 hover:shadow-[2px_2px_0px_0px_#00388F] lg:inline-flex"
							>
								<NextLink href="/auth/signup">Try now</NextLink>
							</Button>
						)}

						{/* Mobile hamburger */}
						<Sheet
							open={mobileMenuOpen}
							onOpenChange={setMobileMenuOpen}
						>
							<SheetTrigger asChild>
								<button
									type="button"
									className="flex size-11 items-center justify-center rounded-full bg-muted text-foreground lg:hidden"
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
										<div
											key={menuItem.label}
											className="w-full"
										>
											<LocaleLink
												href={menuItem.href}
												onClick={() =>
													setMobileMenuOpen(false)
												}
												className="block px-2 py-2 text-base font-medium text-[#1a2a3a]"
												prefetch
											>
												{menuItem.label}
											</LocaleLink>
											{menuItem.children && (
												<div className="mb-1 flex flex-col border-[#1a2a3a]/10 border-l pl-3">
													{menuItem.children.map(
														(child) => (
															<LocaleLink
																key={
																	child.label
																}
																href={
																	child.href
																}
																onClick={() =>
																	setMobileMenuOpen(
																		false,
																	)
																}
																className="flex items-center gap-2 px-2 py-2 text-sm font-medium text-[#1a2a3a]/80"
																prefetch
															>
																<Image
																	src={
																		child.icon
																	}
																	alt=""
																	width={18}
																	height={18}
																	className="size-[18px] shrink-0 object-contain"
																/>
																{child.label}
															</LocaleLink>
														),
													)}
												</div>
											)}
										</div>
									))}
									<NextLink
										href={user ? "/app" : "/auth/signup"}
										onClick={() => setMobileMenuOpen(false)}
										className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-border bg-[#0663DA] px-4 py-3 text-sm font-bold text-primary-foreground shadow-[2px_2px_0px_0px_#00388F] transition-all hover:translate-x-px hover:translate-y-px hover:bg-[#0663DA]/90 hover:shadow-[1px_1px_0px_0px_#00388F]"
									>
										{user ? "Dashboard" : "Try now"}
									</NextLink>
								</div>
							</SheetContent>
						</Sheet>
					</div>
				</div>
			</nav>
		</div>
	);
}
