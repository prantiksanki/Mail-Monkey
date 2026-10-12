import { CheckCircleIcon, LinkIcon, VideoIcon } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";

const CHECKLIST = [
	"Links generated at the moment of booking",
	"Reschedules and cancellations sync both ways",
];

export function ZoomIntegrationHero() {
	return (
		<section className="w-full bg-background px-6 pt-28 pb-16 sm:px-8 sm:pt-36 sm:pb-20">
			<div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
				{/* Left: copy + schedule preview */}
				<div className="flex flex-col">
					<div className="mb-6 flex items-center gap-3">
						<span className="inline-flex items-center gap-2 rounded-md border border-[#2D8CFF]/40 px-2.5 py-1 text-[12px] font-medium text-[#2477e0]">
							<Image
								src="/images/zoom-mark.svg"
								alt=""
								aria-hidden="true"
								width={20}
								height={20}
								className="size-5 shrink-0"
							/>
							Zoom integration
						</span>
					</div>

					<h1 className="font-sans text-[40px] font-bold leading-[1.02] tracking-tight text-foreground sm:text-[52px] md:text-[58px]">
						Every booking.
						<br />
						Instant Zoom link.
					</h1>

					<p className="mt-5 max-w-md text-[16px] leading-[1.6] text-muted-foreground">
						Connect Zoom once. Every meeting booked through
						Popsuites gets its own link the moment it's confirmed —
						no copy-pasting, no manual setup, no missed invites.
					</p>

					<ul className="mt-6 space-y-2.5">
						{CHECKLIST.map((item) => (
							<li
								key={item}
								className="flex items-center gap-2.5 text-[14px] text-foreground"
							>
								<CheckCircleIcon className="size-4 shrink-0 text-[#2D8CFF]" />
								{item}
							</li>
						))}
					</ul>

					<div className="mt-8 rounded-2xl border border-border bg-card p-6">
						<div className="flex items-center justify-between">
							<span className="text-base font-semibold text-foreground">
								Schedule a meeting
							</span>
							<span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
								Preview
							</span>
						</div>

						<Field
							className="mt-4"
							label="Meeting title"
							value="Product launch review"
						/>

						<div className="mt-3 grid grid-cols-2 gap-3">
							<Field label="Date" value="21 May 2026" />
							<Field label="Time" value="10:30 AM" />
						</div>

						<div className="mt-3 grid grid-cols-2 gap-3">
							<Field label="Duration" value="30 min" />
							<Field
								label="Time zone"
								value="(GMT+05:30) India Standard"
							/>
						</div>

						<Field
							className="mt-3"
							label="Attendees"
							value="vanya@popsuites.ai, arjun@popsuites.ai"
						/>

						<div className="mt-3">
							<div className="mb-1.5 text-xs text-muted-foreground">
								Meeting type
							</div>
							<div className="flex items-center gap-6 text-sm text-foreground">
								<span className="flex items-center gap-2">
									<span className="flex size-4 items-center justify-center rounded-full border-2 border-[#2D8CFF]">
										<span className="size-2 rounded-full bg-[#2D8CFF]" />
									</span>
									Video
								</span>
								<span className="flex items-center gap-2">
									<span className="size-4 rounded-full border-2 border-border" />
									Audio only
								</span>
							</div>
						</div>

						<div className="mt-5 flex items-center gap-3">
							<NextLink
								href="/auth/signup"
								prefetch
								className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-[#2D8CFF] px-4 text-sm font-medium text-white transition-colors hover:bg-[#2477e0]"
							>
								<VideoIcon className="size-4 opacity-60" />
								Schedule with Zoom
							</NextLink>
							<span className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-transparent px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">
								Cancel
							</span>
						</div>
					</div>

					<div className="mt-6 border-t border-border pt-4">
						<p className="flex items-center gap-2 text-xs text-muted-foreground">
							<LinkIcon className="size-3.5 shrink-0" />
							Official Zoom OAuth — revoke access any time from
							your Zoom account
						</p>
					</div>
				</div>

				{/* Right: Zoom -> Popsuites connected illustration */}
				<div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
					<Image
						src="/images/zoom-integration-hero.png"
						alt="Zoom connected to Popsuites, showing a live meeting with an auto-generated Zoom link and upcoming meeting details"
						width={1316}
						height={1195}
						sizes="(min-width: 1024px) 32rem, 100vw"
						className="h-auto w-full rounded-2xl"
						priority
					/>
				</div>
			</div>
		</section>
	);
}

function Field({
	label,
	value,
	className,
}: {
	label: string;
	value: string;
	className?: string;
}) {
	return (
		<div className={className}>
			<div className="mb-1.5 text-xs text-muted-foreground">{label}</div>
			<div className="rounded-md border border-border bg-[#F4F7FF] px-3 py-2 text-sm text-foreground">
				{value}
			</div>
		</div>
	);
}
