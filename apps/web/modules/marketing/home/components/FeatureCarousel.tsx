"use client";

import { LocaleLink } from "@i18n/routing";
import { cn } from "@repo/ui";
import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

interface FeatureCard {
	key: string;
	eyebrow: string;
	title: ReactNode;
	description: string;
	href: string;
	visual: ReactNode;
}

interface MockupVisualProps {
	src: string;
	width: number;
	height: number;
	alt: string;
}

function MockupVisual({ src, width, height, alt }: MockupVisualProps) {
	return (
		<div className="relative h-[260px] w-full overflow-hidden rounded-2xl border border-[#d8e6fb] bg-gradient-to-br from-[#eef4ff] to-[#e2edff]">
			<Image
				src={src}
				alt={alt}
				width={width}
				height={height}
				sizes="(min-width: 640px) 400px, 85vw"
				className="absolute inset-0 h-full w-full scale-[1.35] object-cover object-center"
			/>
		</div>
	);
}

const cards: FeatureCard[] = [
	{
		key: "every-integration",
		eyebrow: "Integrations",
		title: "Every tool, one place.",
		description:
			"Telegram, Google, Slack, Zoom, WhatsApp, Meet, HubSpot, Outlook, Teams — all connected, all in sync.",
		href: "/features/every-integration",
		visual: (
			<MockupVisual
				src="/images/integration-mockups/mockup-1.png"
				width={1530}
				height={1028}
				alt="Mail Monkey unified inbox with Gmail, Slack, Zoom, Telegram, WhatsApp, HubSpot, Notion and more connected"
			/>
		),
	},
	{
		key: "inbox-transformed",
		eyebrow: "The transformation",
		title: "Inbox, transformed.",
		description: "From chaos to calm — automatically.",
		href: "/features/inbox-transformed",
		visual: (
			<MockupVisual
				src="/images/integration-mockups/mockup-2.png"
				width={1536}
				height={1024}
				alt="Before and after: a cluttered 1,248-email inbox transformed into a calm 12-email inbox"
			/>
		),
	},
	{
		key: "email-intelligence",
		eyebrow: "Intelligence",
		title: (
			<>
				Email intelligence.
				<br />
				Built in.
			</>
		),
		description:
			"Mail Monkey reads your mail the way you do — and acts the way you would.",
		href: "/features/email-intelligence",
		visual: (
			<MockupVisual
				src="/images/integration-mockups/mockup-3.png"
				width={1506}
				height={838}
				alt="Mail Monkey understanding email context, auto-labeling, and applying rules instantly"
			/>
		),
	},
	{
		key: "smart-archiving",
		eyebrow: "Smart archiving",
		title: (
			<>
				Archives everything.
				<br />
				Misses nothing.
			</>
		),
		description:
			"Newsletters, receipts, shipping updates, bank statements — all auto-filed the moment they arrive.",
		href: "/features/smart-archiving",
		visual: (
			<MockupVisual
				src="/images/integration-mockups/mockup-4.png"
				width={1832}
				height={858}
				alt="Mail from Gmail, Outlook, Yahoo Mail and other providers being routed and filed automatically"
			/>
		),
	},
	{
		key: "multi-account",
		eyebrow: "Multi-account",
		title: (
			<>
				Every account.
				<br />
				One place.
			</>
		),
		description:
			"Gmail, Outlook, work, side projects — all unified in a single view.",
		href: "/features/multi-account",
		visual: (
			<MockupVisual
				src="/images/integration-mockups/mockup-5.png"
				width={1536}
				height={1024}
				alt="Gmail, Outlook, and Yahoo Mail accounts all feeding into one unified Mail Monkey inbox"
			/>
		),
	},
];

export function FeatureCarousel() {
	return (
		<section
			id="features"
			className="w-full scroll-mt-24 bg-background px-6 py-20 sm:px-8 sm:py-24"
		>
			<div className="mx-auto mb-10 max-w-2xl text-center sm:mb-14">
				<span className="mb-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
					Features
				</span>
				<h2 className="font-sans text-[34px] font-normal leading-[1.05] tracking-tight text-foreground sm:text-[40px] md:text-[48px]">
					Everything your inbox needs.
					<br />
					Nothing it doesn't.
				</h2>
			</div>

			<div className="no-scrollbar w-full overflow-x-auto [scroll-snap-type:x_mandatory] [-webkit-overflow-scrolling:touch]">
				<div className="mx-auto flex w-max gap-5 px-6 pb-4 sm:px-8">
					{cards.map((card) => (
						<article
							key={card.key}
							className="flex w-[85vw] shrink-0 snap-start flex-col rounded-[1.75rem] border border-[#dce8fb] bg-gradient-to-b from-white to-[#f5f9ff] p-6 shadow-[0_24px_60px_-30px_rgba(15,42,90,0.35)] sm:w-[440px] sm:p-7"
						>
							<span className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-primary">
								{card.eyebrow}
							</span>
							<h3 className="mb-2.5 font-sans text-[26px] font-semibold leading-[1.1] tracking-tight text-slate-900">
								{card.title}
							</h3>
							<p className="mb-5 text-[14px] leading-[1.6] text-slate-600">
								{card.description}
							</p>

							<div className="mb-6 flex-1">{card.visual}</div>

							<div className="flex flex-wrap items-center gap-3">
								<LocaleLink
									href={card.href}
									prefetch
									className={cn(
										"inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:no-underline",
									)}
								>
									Learn more
									<ArrowRightIcon className="size-3.5" />
								</LocaleLink>
								<LocaleLink
									href="/auth/signup"
									prefetch
									className="inline-flex items-center gap-2 rounded-full bg-[#0663DA] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(6,99,218,0.7)] transition-colors hover:bg-[#0663DA]/90 hover:no-underline"
								>
									Setup in 3 min
									<ArrowRightIcon className="size-3.5" />
								</LocaleLink>
							</div>
						</article>
					))}
				</div>
			</div>
		</section>
	);
}
