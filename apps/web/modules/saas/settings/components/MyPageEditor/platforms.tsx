import {
	GithubIcon,
	GlobeIcon,
	LinkedinIcon,
	SlidersHorizontalIcon,
} from "lucide-react";
import {
	siFacebook,
	siInstagram,
	siTiktok,
	siX,
	siYoutube,
} from "simple-icons";

import type { Platform } from "./types";

function BrandIcon({
	icon,
	className,
}: {
	icon: { path: string; hex: string };
	className?: string;
}) {
	return (
		<svg
			role="img"
			viewBox="0 0 24 24"
			className={className}
			fill={`#${icon.hex}`}
			aria-hidden="true"
		>
			<path d={icon.path} />
		</svg>
	);
}

export const PLATFORM_META: Record<
	Platform,
	{
		label: string;
		placeholder: string;
		icon: (className?: string) => React.ReactNode;
	}
> = {
	website: {
		label: "Portfolio / Website",
		placeholder: "https://yourwebsite.com",
		icon: (className) => <GlobeIcon className={className} />,
	},
	instagram: {
		label: "Instagram",
		placeholder: "https://instagram.com/username",
		icon: (className) => (
			<BrandIcon icon={siInstagram} className={className} />
		),
	},
	facebook: {
		label: "Facebook",
		placeholder: "https://facebook.com/username",
		icon: (className) => (
			<BrandIcon icon={siFacebook} className={className} />
		),
	},
	x: {
		label: "X (Twitter)",
		placeholder: "https://x.com/username",
		icon: (className) => <BrandIcon icon={siX} className={className} />,
	},
	linkedin: {
		label: "LinkedIn",
		placeholder: "https://linkedin.com/in/username",
		icon: (className) => <LinkedinIcon className={className} />,
	},
	github: {
		label: "GitHub",
		placeholder: "https://github.com/username",
		icon: (className) => <GithubIcon className={className} />,
	},
	tiktok: {
		label: "TikTok",
		placeholder: "https://tiktok.com/@username",
		icon: (className) => (
			<BrandIcon icon={siTiktok} className={className} />
		),
	},
	youtube: {
		label: "YouTube",
		placeholder: "https://youtube.com/@username",
		icon: (className) => (
			<BrandIcon icon={siYoutube} className={className} />
		),
	},
	custom: {
		label: "Custom link",
		placeholder: "https://…",
		icon: (className) => <SlidersHorizontalIcon className={className} />,
	},
};

export const PLATFORM_ORDER: Platform[] = [
	"website",
	"instagram",
	"facebook",
	"x",
	"linkedin",
	"github",
	"tiktok",
	"youtube",
	"custom",
];
