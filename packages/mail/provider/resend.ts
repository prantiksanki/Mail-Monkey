import { Resend } from "resend";
import { config } from "../config";
import type { SendEmailHandler } from "../types";

let resend: Resend | undefined;

function getResendClient() {
	if (!resend) {
		resend = new Resend(process.env.RESEND_API_KEY);
	}
	return resend;
}

export const send: SendEmailHandler = async ({
	to,
	from,
	subject,
	cc,
	bcc,
	replyTo,
	html,
	text,
}) => {
	const { error } = await getResendClient().emails.send({
		from: from ?? config.mailFrom,
		to: [to],
		cc,
		bcc,
		replyTo,
		subject,
		html,
		text,
	});

	// The Resend SDK returns API errors in the result instead of throwing.
	// Surface them so callers (and logs) see the real failure reason.
	if (error) {
		throw new Error(`Resend failed to send email: ${error.message}`);
	}
};
