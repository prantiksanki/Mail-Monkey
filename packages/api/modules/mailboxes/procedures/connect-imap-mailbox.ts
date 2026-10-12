import { ORPCError } from "@orpc/server";
import { parseGaCookies } from "@repo/analytics";
import { trackMailboxConnect } from "@repo/auth/lib/analytics-events";
import { getMailboxesByUserId } from "@repo/database";
import { canConnectMailbox } from "@repo/payments/lib/plan-limits";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import { finishImapConnect } from "../lib/connect-imap";
import { ConnectImapMailboxSchema } from "../types";

export const connectImapMailbox = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/connect-imap",
		tags: ["Mailboxes"],
		summary: "Connect a custom-domain mailbox over IMAP/SMTP",
	})
	.input(ConnectImapMailboxSchema)
	.handler(async ({ input, context }) => {
		// In-app "add another mailbox": enforce the plan's mailbox limit here,
		// not only in the dialog. (The pre-signup flow uses
		// finishPendingImapMailbox, which is deliberately not gated — the user
		// has no plan yet and picks one right after, as with Google signup.)
		const planId = await resolveUserPlan(context.user.id);
		const existingMailboxes = await getMailboxesByUserId(context.user.id);
		if (!canConnectMailbox(planId, existingMailboxes.length)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Your plan doesn't allow connecting another mailbox. Start your trial or upgrade to add more.",
			});
		}

		const mailbox = await finishImapConnect({
			userId: context.user.id,
			email: input.email,
			password: input.password,
			imapHost: input.imapHost,
			imapPort: input.imapPort,
			imapSecure: input.imapSecure,
			smtpHost: input.smtpHost,
			smtpPort: input.smtpPort,
			smtpSecure: input.smtpSecure,
		});

		await trackMailboxConnect(
			{ userId: context.user.id, providerId: "imap" },
			parseGaCookies(context.headers.get("cookie")),
		);

		return { mailboxId: mailbox.id, email: mailbox.email };
	});
