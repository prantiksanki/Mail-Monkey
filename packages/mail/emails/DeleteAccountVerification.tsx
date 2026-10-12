import { Link, Text } from "@react-email/components";
import React from "react";
import { createTranslator } from "use-intl/core";
import PrimaryButton from "../components/PrimaryButton";
import Wrapper from "../components/Wrapper";
import type { BaseMailProps } from "../types";
import { defaultLocale, defaultTranslations } from "../util/translations";

export function DeleteAccountVerification({
	url,
	locale,
	translations,
}: {
	url: string;
	name: string;
} & BaseMailProps) {
	const t = createTranslator({
		locale,
		messages: translations,
	});

	return (
		<Wrapper>
			<Text>{t("mail.deleteAccountVerification.body")}</Text>

			<PrimaryButton href={url}>
				{t("mail.deleteAccountVerification.confirmDeletion")} &rarr;
			</PrimaryButton>

			<Text className="text-muted-foreground text-sm">
				{t("mail.common.openLinkInBrowser")}
				<Link href={url} className="break-all">
					{url}
				</Link>
			</Text>
		</Wrapper>
	);
}

DeleteAccountVerification.PreviewProps = {
	locale: defaultLocale,
	translations: defaultTranslations,
	url: "#",
	name: "John Doe",
};

export default DeleteAccountVerification;
