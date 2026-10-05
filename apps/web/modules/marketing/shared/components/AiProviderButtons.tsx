"use client";

import Link from "next/link";

const aiPrompt =
	"Zer0Email (https://zer0email.com) is an AI chief of staff for email. It connects to Gmail or Outlook, automatically routes low-value noise away from the inbox, and surfaces messages that actually need attention — using intelligent routing and auto-labeling with no manual filters needed. It is built specifically for content creators who are drowning in brand deals, collabs, PR pitches, and fan messages; solo founders juggling sales, support, recruiting, and investor emails all at once; and small teams managing high volumes of client, partner, or operational email. This is not a generic email tool — it is for people whose inbox is a core part of their work but also their biggest daily distraction. Based on the site, explain what problem Zer0Email solves, who it is built for, and what makes it different from regular email filters or folders.";

const aiProviders = [
	{
		name: "ChatGPT",
		href: `https://chatgpt.com/?q=${encodeURIComponent(aiPrompt)}`,
		copyPrompt: false,
		logo: (
			<svg
				viewBox="0 0 24 24"
				className="size-5 fill-white"
				aria-hidden="true"
			>
				<path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0L4.252 14.33a4.505 4.505 0 0 1-1.912-6.434zm16.597 3.855-5.843-3.387 2.02-1.164a.076.076 0 0 1 .071 0l4.566 2.637a4.507 4.507 0 0 1-.7 8.125V11.37a.785.785 0 0 0-.114-.62zm2.01-3.023-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.566-2.633a4.5 4.5 0 0 1 6.665 4.661zm-12.64 4.135-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
			</svg>
		),
	},
	{
		name: "Claude",
		href: `https://claude.ai/new?q=${encodeURIComponent(aiPrompt)}`,
		copyPrompt: false,
		logo: (
			<svg
				viewBox="0 0 24 24"
				className="size-5 fill-white"
				aria-hidden="true"
			>
				<path d="M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-1.06-.073-.692-.17-.327-.444.097-.663.49-.468.754.097 1.11.146 2.007.2 2.435.267 1.692.194h.34l.073-.242-.146-.121-1.692-.991-2.871-1.789-1.23-.83-.759-.564-.516-.62-.036-.734.37-.613.662-.258.807.17.636.395 1.134.784 2.18 1.607 1.981 1.559.556.428.194-.097V10.5l-.146-.324-.936-2.004-.936-2.25-.515-1.4-.17-.78.097-.832.492-.516.686-.097.612.258.388.564.468 1.11.612 1.607.928 2.25.928 2.17.267.662.146.073.17-.097.036-.316-.146-.783-.314-2.17-.266-2.17-.121-1.462.073-.468.29-.492.613-.29.734.17.492.564.388 1.08.388 2.444.338 2.395.073.638v.34l.218.146.146-.097.34-.468.992-1.365 1.268-1.583.928-1.06.662-.662.662-.29.735.097.467.517-.024.734-.418.637-.702.807-1.16 1.559-.832 1.19-.613.928-.17.388.073.17.194.048h.024l2.262-.412 2.456-.29 1.268-.097.928.29.437.565-.024.734-.34.492-.564.194-1.17.17-2.02.267-2.02.34-1.073.242-.34.194-.048.275.097.097.734.782 1.486 1.51 1.231 1.316.783 1.012.29.662-.194.637-.613.29-.613-.048-.516-.37-.783-.855-1.11-1.413-.997-1.316-.66-.903-.364-.048-.28.088-.048.3.178.726.517 2.31.459 2.166.226 1.11.05.734-.234.638-.516.394-.734-.048-.57-.315-.428-.734-.758-2.02-.735-2.457-.483-1.268-.193-.34.048-.146.267.048.314.814 1.946.928 2.02.612 1.607.242.928-.097.783-.516.564-.735.073-.662-.314-.34-.517-.63-1.462-.928-2.13-.783-1.993-.58-1.51-.048-.388-.146-.05-.194.05-.29.33-1.11 1.267-1.607 1.559-.928.976-.807.613-.734.048-.638-.388-.29-.686.19-.637.461-.612.967-.904 1.462-1.583 1.11-1.316.37-.516.048-.29-.17H9.25l-.395.097-1.73.484-2.36.612-1.607.34-.735-.048-.637-.395-.194-.637.242-.637.612-.315z" />
			</svg>
		),
	},
	{
		name: "Gemini",
		href: "https://gemini.google.com/app",
		copyPrompt: true,
		logo: (
			<svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
				<defs>
					<linearGradient
						id="gemini-grad"
						x1="0%"
						y1="0%"
						x2="100%"
						y2="100%"
					>
						<stop offset="0%" stopColor="#4285F4" />
						<stop offset="50%" stopColor="#9B72CB" />
						<stop offset="100%" stopColor="#D96570" />
					</linearGradient>
				</defs>
				<path
					fill="url(#gemini-grad)"
					d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12"
				/>
			</svg>
		),
	},
	{
		name: "Perplexity",
		href: `https://www.perplexity.ai/search?q=${encodeURIComponent(aiPrompt)}`,
		copyPrompt: false,
		logo: (
			<svg
				viewBox="0 0 24 24"
				className="size-5 fill-white"
				aria-hidden="true"
			>
				<path d="M22.3527 8.6905H17.5102V0.9395L11.9204 6.233V0L6.3306 5.3774V0.9395H1.6475L1.6476 13.2619H3.5899V23.0605H11.9204H20.2509V13.2619H22.3527V8.6905ZM17.5102 2.7021V8.6905H13.013L17.5102 2.7021ZM11.9204 7.5715L7.5991 2.7021V7.5715H11.9204ZM7.5991 9.623H6.3306H3.4253V7.6183H6.3306H7.5991V9.623ZM9.647 21.0127H5.4419V13.2619H9.647V21.0127ZM9.647 11.2572H5.4419V10.6719H9.647V11.2572ZM11.9204 9.623H9.6469V7.6183H11.9204H14.1938V9.623H11.9204ZM14.3989 21.0127H14.1938H13.8525H11.9204V13.2619H14.3989V21.0127ZM18.3989 21.0127H16.2467V13.2619H18.3989V21.0127ZM20.4045 11.2572H14.1938V10.6719H20.4045V11.2572ZM20.4045 9.623H16.4517H14.1938V7.6183H20.4045V9.623Z" />
			</svg>
		),
	},
];

export function AiProviderButtons() {
	function handleGeminiClick(_e: React.MouseEvent<HTMLAnchorElement>) {
		navigator.clipboard.writeText(aiPrompt).catch(() => {});
	}

	return (
		<div className="flex flex-wrap items-center gap-3">
			{aiProviders.map(({ name, href, copyPrompt, logo }) =>
				copyPrompt ? (
					<a
						key={name}
						href={href}
						target="_blank"
						rel="noreferrer"
						onClick={handleGeminiClick}
						aria-label="Ask Gemini about Zer0Email"
						className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:border-white/20 hover:bg-white/10"
					>
						{logo}
					</a>
				) : (
					<Link
						key={name}
						href={href}
						target="_blank"
						rel="noreferrer"
						aria-label={`Ask ${name} about Zer0Email`}
						className="flex size-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:border-white/20 hover:bg-white/10"
					>
						{logo}
					</Link>
				),
			)}
		</div>
	);
}
