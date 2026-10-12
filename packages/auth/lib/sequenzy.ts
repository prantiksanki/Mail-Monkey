import { logger } from "@repo/logs";

const SEQUENZY_SUBSCRIBERS_URL = "https://api.sequenzy.com/api/v1/subscribers";

interface SequenzySubscriberUser {
	email: string;
	name?: string | null;
}

export async function addSequenzySubscriber(user: SequenzySubscriberUser) {
	const apiKey = process.env.SEQUENZY_API_KEY;

	if (!apiKey) {
		logger.warn(
			"SEQUENZY_API_KEY is not set - skipping Sequenzy subscriber sync",
			{ email: user.email },
		);
		return;
	}

	try {
		const response = await fetch(SEQUENZY_SUBSCRIBERS_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				email: user.email,
				name: user.name ?? undefined,
				enrollInSequences: true,
				tags: ["signup"],
				source: "zer0email-signup",
			}),
		});

		if (!response.ok) {
			logger.error("Failed to add subscriber to Sequenzy", {
				email: user.email,
				status: response.status,
				body: await response.text(),
			});
		}
	} catch (error) {
		// Don't let a failed Sequenzy call block signup
		logger.error("Failed to call Sequenzy subscribers API", {
			email: user.email,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
