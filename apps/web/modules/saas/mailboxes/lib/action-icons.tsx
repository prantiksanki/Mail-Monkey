import {
	ArchiveIcon,
	ForwardIcon,
	type LucideIcon,
	MailOpenIcon,
	PencilLineIcon,
	ReplyIcon,
	ShieldAlertIcon,
	TagIcon,
} from "lucide-react";

export function getActionIcon(actionType: string | undefined): LucideIcon {
	switch (actionType) {
		case "ARCHIVE":
			return ArchiveIcon;
		case "MARK_READ":
			return MailOpenIcon;
		case "DRAFT_EMAIL":
			return PencilLineIcon;
		case "REPLY":
			return ReplyIcon;
		case "FORWARD":
			return ForwardIcon;
		case "MARK_SPAM":
			return ShieldAlertIcon;
		default:
			return TagIcon;
	}
}
