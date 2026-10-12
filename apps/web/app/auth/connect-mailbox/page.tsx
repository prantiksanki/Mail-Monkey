import { ConnectMailboxForm } from "@saas/auth/components/ConnectMailboxForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("mailboxes.connectImapDialog.title"),
	};
}

export default function ConnectMailboxPage() {
	return <ConnectMailboxForm />;
}
