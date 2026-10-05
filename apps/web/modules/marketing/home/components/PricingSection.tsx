"use client";

import NumberFlow from "@number-flow/react";
import { buttonVariants, cn } from "@repo/ui";
import confetti from "canvas-confetti";
import { motion, useSpring } from "framer-motion";
import { Check, Star as LucideStar } from "lucide-react";
import Link from "next/link";
import React, {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

// --- PLAN DATA ---

interface PricingPlan {
	name: string;
	price: string;
	yearlyPrice: string;
	period: string;
	features: string[];
	description: string;
	buttonText: string;
	href: string;
	isPopular?: boolean;
}

const PLANS: PricingPlan[] = [
	{
		name: "Free",
		price: "0",
		yearlyPrice: "0",
		period: "month",
		description: "For trying it out",
		features: [
			"1 mailbox (Gmail or Outlook)",
			"5 rules per mailbox",
			"100 emails / mo",
			"Rule templates library",
			"Activity logs",
			"Community support",
		],
		buttonText: "Get started free",
		href: "/auth/signup",
	},
	{
		name: "Pro",
		price: "9",
		yearlyPrice: "7",
		period: "month",
		description: "For a quieter inbox",
		features: [
			"Unlimited mailboxes",
			"Unlimited rules / mailbox",
			"10,000 emails / mo",
			"Inbox intelligence",
			"AI rule assistant",
			"Automation analytics",
			"Full rule engine",
			"Priority support",
		],
		buttonText: "Get Pro",
		href: "/auth/signup",
		isPopular: true,
	},
];

// --- CONTEXT ---

const PricingContext = createContext<{
	isMonthly: boolean;
	setIsMonthly: (v: boolean) => void;
}>({ isMonthly: true, setIsMonthly: () => {} });

// --- STARFIELD ---

function seededUnit(seed: number) {
	const value = Math.sin(seed * 9999) * 10000;
	return value - Math.floor(value);
}

function Star({
	index,
	mousePosition,
	containerRef,
}: {
	index: number;
	mousePosition: { x: number | null; y: number | null };
	containerRef: React.RefObject<HTMLDivElement>;
}) {
	const top = `${(seededUnit(index + 1) * 100).toFixed(4)}%`;
	const left = `${(seededUnit(index + 101) * 100).toFixed(4)}%`;
	const size = `${(1 + seededUnit(index + 1001) * 2).toFixed(4)}px`;
	const duration = 2 + seededUnit(index + 2001) * 3;
	const delay = seededUnit(index + 3001) * 5;

	const springConfig = { stiffness: 100, damping: 15, mass: 0.1 };
	const springX = useSpring(0, springConfig);
	const springY = useSpring(0, springConfig);

	useEffect(() => {
		if (
			!containerRef.current ||
			mousePosition.x === null ||
			mousePosition.y === null
		) {
			springX.set(0);
			springY.set(0);
			return;
		}

		const containerRect = containerRef.current.getBoundingClientRect();
		const starX =
			containerRect.left +
			(Number.parseFloat(left) / 100) * containerRect.width;
		const starY =
			containerRect.top +
			(Number.parseFloat(top) / 100) * containerRect.height;

		const deltaX = mousePosition.x - starX;
		const deltaY = mousePosition.y - starY;
		const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const radius = 600;

		if (distance < radius) {
			const force = 1 - distance / radius;
			springX.set(deltaX * force * 0.5);
			springY.set(deltaY * force * 0.5);
		} else {
			springX.set(0);
			springY.set(0);
		}
	}, [containerRef, left, mousePosition, springX, springY, top]);

	return (
		<motion.div
			className="absolute rounded-full bg-white/60"
			style={{
				top,
				left,
				width: size,
				height: size,
				x: springX,
				y: springY,
			}}
			initial={{ opacity: 0 }}
			animate={{ opacity: [0, 1, 0] }}
			transition={{
				duration,
				repeat: Number.POSITIVE_INFINITY,
				delay,
			}}
		/>
	);
}

function InteractiveStarfield({
	mousePosition,
	containerRef,
}: {
	mousePosition: { x: number | null; y: number | null };
	containerRef: React.RefObject<HTMLDivElement>;
}) {
	return (
		<div className="pointer-events-none absolute inset-0 overflow-hidden">
			{Array.from({ length: 150 }).map((_, i) => (
				<Star
					key={`star-${i}`}
					index={i}
					mousePosition={mousePosition}
					containerRef={containerRef}
				/>
			))}
		</div>
	);
}

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
				colors: ["#ffffff", "#aaaaaa", "#555555"],
				ticks: 300,
				gravity: 1.2,
				decay: 0.94,
				startVelocity: 30,
			});
		}
	};

	return (
		<div className="flex justify-center">
			<div className="relative flex w-fit items-center rounded-full border border-white/15 bg-white/[0.06] p-1 backdrop-blur-sm">
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
						"relative z-10 rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-200",
						isMonthly
							? "text-black"
							: "text-white/60 hover:text-white/85",
					)}
				>
					Monthly
				</button>
				<button
					ref={annualBtnRef}
					onClick={() => handleToggle(false)}
					type="button"
					className={cn(
						"relative z-10 rounded-full px-5 py-1.5 text-sm font-medium transition-colors duration-200",
						!isMonthly
							? "text-black"
							: "text-white/60 hover:text-white/85",
					)}
				>
					Annual
					<span
						className={cn(
							"hidden sm:inline",
							!isMonthly ? "text-black/70" : "",
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
				"group relative flex flex-col rounded-2xl p-8 transition-colors duration-300",
				plan.isPopular
					? "border-2 border-white/40 bg-white/[0.08] shadow-[0_0_80px_-16px_rgba(255,255,255,0.15)]"
					: "border border-white/10 bg-white/[0.04] hover:border-white/18 hover:bg-white/[0.055]",
			)}
		>
			{/* Top accent line */}
			<div
				className={cn(
					"absolute inset-x-0 top-0 h-px rounded-t-2xl",
					plan.isPopular
						? "bg-linear-to-r from-transparent via-white/50 to-transparent"
						: "bg-linear-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100",
				)}
			/>

			{/* Popular badge */}
			{plan.isPopular && (
				<div className="absolute -top-4 left-1/2 -translate-x-1/2">
					<div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white px-4 py-1.5">
						<LucideStar className="h-3.5 w-3.5 fill-black text-black" />
						<span className="text-xs font-semibold text-black">
							Most Popular
						</span>
					</div>
				</div>
			)}

			<div className="flex flex-1 flex-col text-center">
				<h3 className="text-lg font-semibold text-white">
					{plan.name}
				</h3>
				<p className="mt-1.5 text-sm text-white/55">
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
					<span className="text-sm font-medium text-white/45">
						/ {plan.period}
					</span>
				</div>
				<p className="mt-1.5 text-xs text-white/40">
					{isMonthly ? "Billed Monthly" : "Billed Annually"}
				</p>

				{/* Features */}
				<ul className="mt-8 space-y-3 text-left text-sm text-white/70">
					{plan.features.map((feature) => (
						<li key={feature} className="flex items-center gap-3">
							<Check
								className={cn(
									"h-4 w-4 shrink-0",
									plan.isPopular
										? "text-white/90"
										: "text-white/55",
								)}
							/>
							{feature}
						</li>
					))}
				</ul>

				{/* CTA */}
				<div className="mt-auto pt-8">
					{plan.isPopular ? (
						<Link
							href={plan.href}
							className="flex h-11 w-full items-center justify-center rounded-xl bg-white text-sm font-semibold text-black shadow-[0_4px_24px_-4px_rgba(255,255,255,0.25)] transition-all duration-300 hover:bg-white/90 hover:shadow-[0_4px_32px_-4px_rgba(255,255,255,0.35)]"
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
								"w-full border-white/14 bg-white/[0.06] text-white/75 hover:border-white/25 hover:bg-white/[0.09] hover:text-white",
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
	const containerRef = useRef<HTMLDivElement>(null);
	const [mousePosition, setMousePosition] = useState<{
		x: number | null;
		y: number | null;
	}>({
		x: null,
		y: null,
	});

	const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
		setMousePosition({ x: event.clientX, y: event.clientY });
	};

	return (
		<PricingContext.Provider value={{ isMonthly, setIsMonthly }}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: mouse position tracked for decorative starfield only */}
			<section
				id="pricing"
				ref={containerRef}
				onMouseMove={handleMouseMove}
				onMouseLeave={() => setMousePosition({ x: null, y: null })}
				className="relative w-full scroll-mt-24 overflow-hidden bg-black px-6 py-24 sm:px-8 sm:py-32"
			>
				{/* Subtle white ambient glow */}
				<div className="pointer-events-none absolute -top-60 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#ffffff_0%,transparent_70%)] opacity-[0.04] blur-[140px]" />

				{/* Dot grid */}
				<div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(#ffffff18_1px,transparent_1px)] [background-size:32px_32px]" />

				<InteractiveStarfield
					mousePosition={mousePosition}
					containerRef={
						containerRef as React.RefObject<HTMLDivElement>
					}
				/>

				<div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center gap-12">
					{/* Heading */}
					<motion.div
						initial={{ opacity: 0, y: 16 }}
						whileInView={{ opacity: 1, y: 0 }}
						viewport={{ once: true }}
						transition={{
							duration: 0.6,
							ease: [0.21, 0.47, 0.32, 0.98],
						}}
						className="flex flex-col items-center gap-3 text-center"
					>
						<span className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-white/55">
							Pricing
						</span>
						<h2 className="font-[family-name:var(--font-bricolage)] text-[clamp(2.2rem,5.5vw,4rem)] font-extrabold leading-[0.97] tracking-[-0.04em] text-white">
							Simple. Honest.
							<br />
							<span className="text-white/62">No surprises.</span>
						</h2>
						<p className="max-w-md text-[18px] leading-relaxed text-white/80">
							Start free. Upgrade when you&apos;re ready.
						</p>
					</motion.div>

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
						className="text-[12px] text-white/38"
					>
						All plans include SSL encryption and 99.9% uptime SLA.
					</motion.p>
				</div>
			</section>
		</PricingContext.Provider>
	);
}
