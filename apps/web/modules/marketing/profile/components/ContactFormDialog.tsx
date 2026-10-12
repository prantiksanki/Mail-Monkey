"use client";

import { ProfileContactForm } from "@marketing/profile/components/ProfileContactForm";
import { ProfileLinkIcon } from "@marketing/profile/components/ProfileLinkIcon";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@repo/ui/components/dialog";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function ContactFormDialog({
	username,
	label,
	className,
	style,
	variant = "pill",
}: {
	username: string;
	label: string;
	className?: string;
	style?: React.CSSProperties;
	variant?: "featured" | "pill";
}) {
	const t = useTranslations();
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<button type="button" className={className} style={style}>
					<ProfileLinkIcon
						isContactForm
						className={
							variant === "featured" ? "size-4" : "size-3.5"
						}
					/>
					{label}
				</button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("profile.contactForm.title")}</DialogTitle>
				</DialogHeader>
				<ProfileContactForm username={username} />
			</DialogContent>
		</Dialog>
	);
}
