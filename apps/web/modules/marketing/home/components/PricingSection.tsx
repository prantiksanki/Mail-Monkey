"use client";

import NumberFlow from "@number-flow/react";
import { buttonVariants, cn } from "@repo/ui";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { Check, Star as LucideStar, X } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useEffect, useRef, useState } from "react";

// --- PLAN DATA ---

interface PricingPlan {
	name: string;
	price: string;
	yearlyPrice: string;
	period: string;
	features: string[];
	unavailableFeatures?: string[];
	description: string;
	buttonText: string;
	href: string;
	isPopular?: boolean;
}

const PLANS: PricingPlan[] = [
	{
		name: "Starter",
		price: "4",
		yearlyPrice: "3",
		period: "month",
		description: "For a quieter inbox",
		features: [
			"Up to 3 mailboxes (Gmail or Outlook)",
			"Email productivity suite",
			"AI Assistant (chat)",
			"Auto Drafts",
			"Unlimited rules",
			"3,000 emails processed / mo",
		],
		unavailableFeatures: ["No calendar, meetings, or voice"],
		buttonText: "Start 7-day trial",
		href: "/auth/signup",
	},
	{
		name: "Pro",
		price: "10",
		yearlyPrice: "9",
		period: "month",
		description: "For calendars, meetings, and voice",
		features: [
			"Unlimited Gmail + Outlook accounts",
			"Everything in Starter",
			"Calendar & scheduling — cross-account",
			"Google Meet · Zoom · Teams · Zoho",
			"Voice — 300 min / mo, then $15 / 500 min",
			"15,000 emails processed / mo",
			"Priority support",
		],
		buttonText: "Start 7-day trial",
		href: "/auth/signup",
		isPopular: true,
	},
];

// --- CONTEXT ---

const PricingContext = createContext<{
	isMonthly: boolean;
	setIsMonthly: (v: boolean) => void;
}>({ isMonthly: true, setIsMonthly: () => {} });

// --- TOGGLE ---

function PricingToggle() {
	const { isMonthly, setIsMonthly } = useContext(PricingContext);
	const annualBtnRef = useRef<HTMLButtonElement>(null);
	const monthlyBtnRef = useRef<HTMLButtonElement>(null);
	const [pillStyle, setPillStyle] = useState<{ width: number; x: number }>({
		width: 0,
		x: 0,
	});

	useEffect(() => {
		const btnRef = isMonthly ? monthlyBtnRef : annualBtnRef;
		if (btnRef.current) {
			setPillStyle({
				width: btnRef.current.offsetWidth,
				x: btnRef.current.offsetLeft,
			});
		}
	}, [isMonthly]);

	const handleToggle = (monthly: boolean) => {
		if (isMonthly === monthly) {
			return;
		}
		setIsMonthly(monthly);

		if (!monthly && annualBtnRef.current) {
			const rect = annualBtnRef.current.getBoundingClientRect();
			confetti({
				particleCount: 80,
				spread: 80,
				origin: {
					x: (rect.left + rect.width / 2) / window.innerWidth,
					y: (rect.top + rect.height / 2) / window.innerHeight,
				},
				colors: ["hsl(214,95%,44%)", "#5B9BFF", "#00388F"],
				ticks: 300,
				gravity: 1.2,
				decay: 0.94,
				startVelocity: 30,
			});
		}
	};

	return (
		<div className="flex justify-center">
			<div className="relative flex w-fit items-center rounded-full border border-white/15 bg-white/[0.08] p-1 backdrop-blur-sm">
				<motion.div
					className="absolute left-0 top-0 h-full rounded-full bg-white p-1"
					animate={pillStyle}
					transition={{ type: "spring", stiffness: 500, damping: 40 }}
				/>
				<button
					ref={monthlyBtnRef}
					onClick={() => handleToggle(true)}
					type="button"
					className={cn(
						"relative z-10 rounded-full px-5 py-1.5 text-sm font-semibold transition-colors duration-200",
						isMonthly
							? "text-[hsl(214,95%,44%)]"
							: "text-white/75 hover:text-white",
					)}
				>
					Monthly
				</button>
				<button
					ref={annualBtnRef}
					onClick={() => handleToggle(false)}
					type="button"
					className={cn(
						"relative z-10 rounded-full px-5 py-1.5 text-sm font-semibold transition-colors duration-200",
						!isMonthly
							? "text-[hsl(214,95%,44%)]"
							: "text-white/75 hover:text-white",
					)}
				>
					Annual
					<span
						className={cn(
							"hidden sm:inline",
							!isMonthly ? "text-[hsl(214,95%,44%)]/80" : "",
						)}
					>
						{" "}
						(Save 20%)
					</span>
				</button>
			</div>
		</div>
	);
}

// --- CARD ---

function PricingCard({ plan, index }: { plan: PricingPlan; index: number }) {
	const { isMonthly } = useContext(PricingContext);
	return (
		<motion.div
			initial={{ y: 50, opacity: 0 }}
			whileInView={{
				y: 0,
				opacity: 1,
			}}
			viewport={{ once: true }}
			transition={{
				duration: 0.6,
				type: "spring",
				stiffness: 100,
				damping: 20,
				delay: index * 0.15,
			}}
			className={cn(
				"group relative flex flex-col rounded-[28px] p-8 transition-all duration-300",
				plan.isPopular
					? "border border-white/20 bg-[#00388F] shadow-[0_0_60px_-12px_rgba(255,255,255,0.2)]"
					: "border border-white/10 bg-[#00388F]/60 hover:border-white/20 hover:bg-[#00388F]/80",
			)}
		>
			{/* Popular badge */}
			{plan.isPopular && (
				<div className="absolute -top-4 left-1/2 -translate-x-1/2">
					<div className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5">
						<LucideStar className="h-3.5 w-3.5 fill-[hsl(214,95%,44%)] text-[hsl(214,95%,44%)]" />
						<span className="text-xs font-semibold text-[hsl(214,95%,44%)]">
							Most Popular
						</span>
					</div>
				</div>
			)}

			<div className="flex flex-1 flex-col text-center">
				<h3 className="text-lg font-bold text-white">{plan.name}</h3>
				<p className="mt-1.5 text-sm font-medium text-white/70">
					{plan.description}
				</p>

				{/* Price */}
				<div className="mt-6 flex items-baseline justify-center gap-1">
					<span className="font-[family-name:var(--font-bricolage)] text-5xl font-black tracking-tight text-white">
						<NumberFlow
							value={
								isMonthly
									? Number(plan.price)
									: Number(plan.yearlyPrice)
							}
							format={{
								style: "currency",
								currency: "USD",
								minimumFractionDigits: 0,
							}}
						/>
					</span>
					<span className="text-sm font-semibold text-white/70">
						/ {plan.period}
					</span>
				</div>
				<p className="mt-1.5 text-xs font-medium text-white/60">
					{isMonthly ? "Billed Monthly" : "Billed Annually"}
				</p>

				{/* Features */}
				<ul className="mt-8 space-y-3 text-left text-sm font-medium text-white/85">
					{plan.features.map((feature) => (
						<li key={feature} className="flex items-center gap-3">
							<Check
								className={cn(
									"h-4 w-4 shrink-0",
									plan.isPopular
										? "text-white"
										: "text-white/70",
								)}
							/>
							{feature}
						</li>
					))}
					{plan.unavailableFeatures?.map((feature) => (
						<li
							key={feature}
							className="flex items-center gap-3 font-medium text-white/50"
						>
							<X className="h-4 w-4 shrink-0 text-white/45" />
							<span className="line-through">{feature}</span>
						</li>
					))}
				</ul>

				{/* CTA */}
				<div className="mt-auto pt-8">
					{plan.isPopular ? (
						<Link
							href={plan.href}
							className="flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-[hsl(214,95%,44%)] shadow-[0_4px_24px_-4px_rgba(255,255,255,0.35)] transition-all duration-300 hover:bg-white/90"
						>
							{plan.buttonText}
						</Link>
					) : (
						<Link
							href={plan.href}
							className={cn(
								buttonVariants({
									variant: "outline",
									size: "lg",
								}),
								"w-full border-white/20 bg-white/5 font-semibold text-white hover:border-white/35 hover:bg-white/10 hover:text-white",
							)}
						>
							{plan.buttonText}
						</Link>
					)}
				</div>
			</div>
		</motion.div>
	);
}

// --- MAIN EXPORT ---

export function PricingSection() {
	const [isMonthly, setIsMonthly] = useState(true);

	return (
		<PricingContext.Provider value={{ isMonthly, setIsMonthly }}>
			<section
				id="pricing"
				className="relative w-full scroll-mt-24 overflow-hidden rounded-[40px] bg-[hsl(214,95%,44%)] px-6 py-24 sm:px-8 sm:py-32"
			>
				<div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-12">
					{/* Heading (no entrance animation: this holds the LCP element, so it must paint visible immediately) */}
					<div className="flex flex-col items-center gap-3 text-center">
						<span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">
							Pricing
						</span>
						<h1 className="font-[family-name:var(--font-bricolage)] text-[clamp(2.2rem,5.5vw,4rem)] font-extrabold leading-[0.97] tracking-[-0.04em] text-white">
							Simple. Honest.
							<br />
							<span className="text-white/85">No surprises.</span>
						</h1>
						<p className="max-w-md text-[18px] font-medium leading-relaxed text-white/85">
							Try any plan free for 7 days. No charge until your
							trial ends.
						</p>
					</div>

					{/* Toggle */}
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						<PricingToggle />
					</motion.div>

					{/* Cards */}
					<div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
						{PLANS.map((plan, i) => (
							<PricingCard
								key={plan.name}
								plan={plan}
								index={i}
							/>
						))}
					</div>

					{/* Footer note */}
					<motion.p
						initial={{ opacity: 0 }}
						whileInView={{ opacity: 1 }}
						viewport={{ once: true }}
						transition={{ duration: 0.6, delay: 0.4 }}
						className="text-[12px] font-medium text-white/70"
					>
						All plans include SSL encryption and 99.9% uptime SLA.
					</motion.p>
				</div>
			</section>
		</PricingContext.Provider>
	);
}
