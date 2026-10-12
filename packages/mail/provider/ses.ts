import {
	SESv2Client,
	SendEmailCommand,
	type SendEmailCommandInput,
} from "@aws-sdk/client-sesv2";
import { logger } from "@repo/logs";
import { config } from "../config";
import type { SendEmailHandler } from "../types";

const CHARSET = "UTF-8";

let client: SESv2Client | undefined;

function getSesClient() {
	if (!client) {
		const region = process.env.AWS_SES_REGION;

		if (!region) {
			throw new Error("AWS_SES_REGION is not set");
		}

		const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
		const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

		client = new SESv2Client({
			region,
			// When explicit keys are provided use them; otherwise fall back to
			// the AWS SDK's default provider chain (e.g. an IAM role on the
			// deploy target).
			...(accessKeyId && secretAccessKey
				? { credentials: { accessKeyId, secretAccessKey } }
				: {}),
		});
	}

	return client;
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
	const input: SendEmailCommandInput = {
		FromEmailAddress: from ?? config.mailFrom,
		Destination: {
			ToAddresses: [to],
			CcAddresses: cc,
			BccAddresses: bcc,
		},
		ReplyToAddresses: replyTo ? [replyTo] : undefined,
		Content: {
			Simple: {
				Subject: { Data: subject, Charset: CHARSET },
				Body: {
					Text: { Data: text, Charset: CHARSET },
					...(html ? { Html: { Data: html, Charset: CHARSET } } : {}),
				},
			},
		},
	};

	try {
		await getSesClient().send(new SendEmailCommand(input));
	} catch (error) {
		// The SESv2 client throws on API errors; surface the reason so callers
		// and logs see the real failure. Region/from/httpStatusCode are logged
		// alongside it because a bare error name (e.g. the SDK's own
		// "UnknownError" when a non-AWS response can't be deserialized) is
		// otherwise useless for telling "wrong region" apart from "wrong
		// credentials" apart from "network/egress blocked before reaching AWS
		// at all" — see the 2026-09-17 staging-vs-prod SES investigation.
		const metadata =
			error && typeof error === "object" && "$metadata" in error
				? (error as { $metadata?: { httpStatusCode?: number } })
						.$metadata
				: undefined;

		logger.error("SES send failed", {
			error,
			errorName: error instanceof Error ? error.name : undefined,
			httpStatusCode: metadata?.httpStatusCode,
			region: process.env.AWS_SES_REGION,
			from: input.FromEmailAddress,
			hasExplicitCredentials: Boolean(
				process.env.AWS_ACCESS_KEY_ID &&
					process.env.AWS_SECRET_ACCESS_KEY,
			),
		});

		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`SES failed to send email: ${message}`);
	}
};
