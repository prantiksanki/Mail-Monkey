import { ORPCError } from "@orpc/server";
import { getMailboxById, getRuleById } from "@repo/database";

export async function verifyMailboxOwnership(
	mailboxId: string,
	userId: string,
) {
	const mailbox = await getMailboxById(mailboxId);

	if (!mailbox) {
		throw new ORPCError("NOT_FOUND");
	}

	if (mailbox.userId !== userId) {
		throw new ORPCError("FORBIDDEN");
	}

	return mailbox;
}

export async function verifyRuleOwnership(
	ruleId: string,
	mailboxId: string,
	userId: string,
) {
	const rule = await getRuleById(ruleId);
	if (!rule) {
		throw new ORPCError("NOT_FOUND");
	}

	if (rule.mailboxId !== mailboxId) {
		throw new ORPCError("FORBIDDEN");
	}

	await verifyMailboxOwnership(mailboxId, userId);

	return rule;
}
