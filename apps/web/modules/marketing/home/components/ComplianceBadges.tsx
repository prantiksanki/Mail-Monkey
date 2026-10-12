import {
	COMPLIANCE_BADGES,
	type ComplianceBadge,
} from "@marketing/home/lib/compliance-badges";
import { cn } from "@repo/ui";
import { CircleCheck, Clock, ShieldCheck } from "lucide-react";
import Image from "next/image";

export function ComplianceBadges() {
	const badges = COMPLIANCE_BADGES.filter((badge) => badge.enabled);

	return (
		<section
			aria-labelledby="compliance-heading"
			className="w-full bg-[#00388F] px-6 py-16 text-center text-white sm:px-8 md:py-20"
		>
			<h2
				id="compliance-heading"
				className="mb-2 font-sans text-[28px] font-normal leading-[1.1] tracking-tight text-white sm:text-[34px]"
			>
				Security and compliance
			</h2>
			<p className="mb-10 text-[16px] leading-[1.5] text-white/70">
				Independently assessed against the App Defense Alliance CASA
				framework.
			</p>

			<ul className="mx-auto flex max-w-5xl flex-wrap justify-center gap-4">
				{badges.map((badge) => (
					<li
						key={badge.id}
						className="flex w-[calc(50%-0.5rem)] sm:w-40"
					>
						<BadgeCard badge={badge} />
					</li>
				))}
			</ul>
		</section>
	);
}

function BadgeCard({ badge }: { badge: ComplianceBadge }) {
	const isVerified = badge.status === "verified";
	const cardClassName = cn(
		"flex min-h-[200px] w-full flex-col items-center border bg-white/5 p-5",
		isVerified
			? "border-white/20"
			: "border-dashed border-white/25 text-white/60",
	);
	const content = <BadgeContent badge={badge} isVerified={isVerified} />;

	if (isVerified && badge.href) {
		return (
			<a
				href={badge.href}
				target="_blank"
				rel="noopener noreferrer"
				className={cn(
					cardClassName,
					"transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#00388F]",
				)}
			>
				{content}
			</a>
		);
	}

	// Not linked. The in-progress pill is visible text, so screen readers
	// announce e.g. "SOC 2, Type 2 in progress" without an aria-label.
	return <div className={cardClassName}>{content}</div>;
}

function BadgeContent({
	badge,
	isVerified,
}: {
	badge: ComplianceBadge;
	isVerified: boolean;
}) {
	const FallbackIcon = badge.fallbackIcon ?? ShieldCheck;
	const StatusIcon = isVerified ? CircleCheck : Clock;

	return (
		<>
			<div className="flex size-16 items-center justify-center">
				{badge.logoSrc ? (
					<Image
						src={badge.logoSrc}
						alt={badge.logoAlt}
						width={64}
						height={64}
						className="size-16 object-contain invert"
					/>
				) : (
					<FallbackIcon
						role="img"
						aria-label={badge.logoAlt}
						className={cn(
							"size-12",
							isVerified ? "text-white" : "text-white/60",
						)}
						strokeWidth={1.5}
					/>
				)}
			</div>
			<StatusIcon
				aria-hidden="true"
				className="mt-3 size-5 text-white/60"
			/>
			<span
				className={cn(
					"mt-3 text-center text-base font-medium leading-snug",
					isVerified ? "text-white" : "text-white/60",
				)}
			>
				{badge.label}
			</span>
			{!isVerified && (
				<span className="mt-2 rounded-full border border-white/25 px-2 py-0.5 text-xs text-white/70">
					{badge.progressLabel ?? "In progress"}
				</span>
			)}
		</>
	);
}
