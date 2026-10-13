import { PlayIcon, VideoIcon } from "lucide-react";

export function ZoomIntegrationDemo() {
	return (
		<section className="w-full bg-background px-6 py-20 text-center sm:px-8 sm:py-24">
			<span className="mb-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
				See it in action
			</span>
			<div className="mb-2 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Every meeting.
				<br />
				One click away.
			</div>
			<p className="mx-auto mb-10 max-w-2xl text-[18px] leading-[1.5] text-foreground">
				Once Zoom is connected, every upcoming meeting shows its join
				link right inside Mail Monkey — no digging through email.
			</p>

			<div className="mx-auto mb-10 max-w-[560px] overflow-hidden rounded-[2rem] border border-border bg-card text-left shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)]">
				<div className="flex items-center gap-2 border-b border-border bg-muted/50 px-5 py-4">
					<span className="size-[10px] rounded-full bg-foreground/70" />
					<span className="size-[10px] rounded-full bg-foreground/45" />
					<span className="size-[10px] rounded-full bg-foreground/25" />
					<span className="ml-[6px] font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">
						Product walkthrough
					</span>
				</div>

				<button
					type="button"
					aria-label="Play product walkthrough video"
					className="group/video relative flex aspect-video w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#0b1220] via-[#13213b] to-[#1b2942]"
				>
					<span className="absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_25%_30%,rgba(45,140,255,0.35),transparent_45%),radial-gradient(circle_at_75%_70%,rgba(45,140,255,0.25),transparent_50%)]" />
					<span className="relative z-10 flex size-16 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform duration-200 group-hover/video:scale-105">
						<PlayIcon className="ml-1 size-6 fill-[#0b1220] text-[#0b1220]" />
					</span>
					<span className="absolute bottom-4 left-5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/70">
						Mail Monkey + Zoom · 1:24
					</span>
				</button>
			</div>

			<div className="mx-auto max-w-[560px] overflow-hidden rounded-[2rem] border border-border bg-card text-left shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)]">
				<div className="flex items-center justify-between border-b border-border bg-muted/50 px-5 py-4">
					<div className="flex items-center gap-2">
						<span className="size-[10px] rounded-full bg-foreground/70" />
						<span className="size-[10px] rounded-full bg-foreground/45" />
						<span className="size-[10px] rounded-full bg-foreground/25" />
						<span className="ml-[6px] font-mono text-[11px] uppercase tracking-[0.2em] text-foreground">
							Upcoming meetings
						</span>
					</div>
					<span className="font-mono text-[11px] text-muted-foreground">
						View all
					</span>
				</div>

				<div className="flex items-center gap-4 p-5">
					<span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-[#2D8CFF]/10 text-[#2D8CFF]">
						<VideoIcon className="size-5" />
					</span>
					<div className="flex-1">
						<div className="text-[15px] font-medium text-foreground">
							1:1 Consultation
						</div>
						<div className="text-[13px] text-muted-foreground">
							Mon, 24 Aug · 4:00 – 4:30 PM (IST)
						</div>
					</div>
				</div>

				<div className="flex gap-3 border-t border-border p-5">
					<button
						type="button"
						className="flex-1 rounded-full bg-[#2D8CFF] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[#2D8CFF]/90"
					>
						Join Zoom
					</button>
					<button
						type="button"
						className="rounded-full border border-border px-5 py-2.5 text-[14px] text-foreground transition-colors hover:bg-muted"
					>
						Copy Link
					</button>
				</div>
			</div>
		</section>
	);
}
