"use client";

import { useSearchParams } from "next/navigation";
import { InboxPage } from "./InboxPage";
import { MailboxesPage } from "./MailboxesPage";

const INBOX_FOLDERS = [
	"inbox",
	"sent",
	"drafts",
	"trash",
	"spam",
	"scheduled",
	"snoozed",
	"all",
];

export function InboxRouter() {
	const searchParams = useSearchParams();
	const folder = searchParams.get("folder");
	const label = searchParams.get("label");
	const compose = searchParams.get("compose");

	if (
		compose === "true" ||
		label ||
		(folder && INBOX_FOLDERS.includes(folder))
	) {
		return <InboxPage autoCompose={compose === "true"} />;
	}

	return <MailboxesPage />;
}
