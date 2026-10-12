import type { LucideIcon } from "lucide-react";
import { BadgeCheck, ShieldCheck, ShieldEllipsis } from "lucide-react";

export interface ComplianceBadge {
	id: string;
	// Keep to 3 lines at card width.
	label: string;
	// /images/compliance/<id>.svg, drawn black (inverted to white on the
	// dark-blue section; a top-level /compliance path would be caught by the
	// i18n proxy). Omit to render `fallbackIcon` instead.
	logoSrc?: string;
	logoAlt: string;
	fallbackIcon?: LucideIcon;
	status: "verified" | "in_progress";
	// Shown as a pill under the label while status is "in_progress".
	progressLabel?: string;
	// Proof link, opens in a new tab.
	href?: string;
	// false = not rendered.
	enabled: boolean;
}

// Rendered in this order. Adding, removing or promoting a badge should only
// ever require editing this list.
export const COMPLIANCE_BADGES: ComplianceBadge[] = [
	{
		// ADA AL1 (Legacy CASA Tier 2), LoV issued 2026-09-29. Recertify annually.
		// TODO: add href "/images/compliance/casa-letter-of-validation.pdf"
		// once the LoV has been reviewed for public hosting.
		id: "casa",
		label: "CASA Tier 2 Validated",
		logoAlt: "App Defense Alliance CASA",
		fallbackIcon: ShieldCheck,
		status: "verified",
		enabled: true,
	},
	{
		id: "gdpr",
		label: "GDPR",
		logoSrc: "/images/compliance/gdpr.svg",
		logoAlt: "European Union stars",
		status: "verified",
		href: "/legal/privacy-policy",
		enabled: true,
	},
	{
		id: "ccpa",
		label: "CCPA",
		logoSrc: "/images/compliance/ccpa.svg",
		logoAlt: "Outline of California",
		status: "verified",
		href: "/legal/privacy-policy",
		enabled: true,
	},
	{
		// No AICPA logo until the report is issued. Then: status "verified",
		// add logoSrc + href, drop progressLabel.
		id: "soc2",
		label: "SOC 2",
		logoAlt: "SOC 2",
		fallbackIcon: ShieldEllipsis,
		status: "in_progress",
		progressLabel: "Type 2 in progress",
		enabled: true,
	},
	{
		// Google brand rules forbid implying endorsement, so no Google logo.
		id: "google-oauth",
		label: "Google OAuth Verified",
		logoAlt: "Verified",
		fallbackIcon: BadgeCheck,
		status: "verified",
		enabled: true,
	},
	{
		// Enable once the Entra verified-publisher badge is live.
		id: "microsoft-publisher",
		label: "Microsoft Verified Publisher",
		logoAlt: "Verified",
		fallbackIcon: BadgeCheck,
		status: "verified",
		enabled: false,
	},
];
