import {
	GithubIcon,
	GlobeIcon,
	LinkedinIcon,
	MailIcon,
	SlidersHorizontalIcon,
} from "lucide-react";
import {
	siFacebook,
	siInstagram,
	siTiktok,
	siX,
	siYoutube,
} from "simple-icons";

type Platform =
	| "website"
	| "instagram"
	| "facebook"
	| "x"
	| "linkedin"
	| "github"
	| "tiktok"
	| "youtube"
	| "custom";

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

export function ProfileLinkIcon({
	platform,
	isContactForm,
	className,
}: {
	platform?: Platform;
	isContactForm?: boolean;
	className?: string;
}) {
	if (isContactForm) {
		return <MailIcon className={className} />;
	}
	switch (platform) {
		case "instagram":
			return <BrandIcon icon={siInstagram} className={className} />;
		case "facebook":
			return <BrandIcon icon={siFacebook} className={className} />;
		case "x":
			return <BrandIcon icon={siX} className={className} />;
		case "linkedin":
			return <LinkedinIcon className={className} />;
		case "github":
			return <GithubIcon className={className} />;
		case "tiktok":
			return <BrandIcon icon={siTiktok} className={className} />;
		case "youtube":
			return <BrandIcon icon={siYoutube} className={className} />;
		case "custom":
			return <SlidersHorizontalIcon className={className} />;
		default:
			return <GlobeIcon className={className} />;
	}
}
