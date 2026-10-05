import { logger } from "@repo/logs";
import { handleTelegramUpdate, type TelegramUpdate } from "./service";

export async function telegramWebhookHandler(request: Request) {
	const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
	if (
		expectedSecret &&
		request.headers.get("x-telegram-bot-api-secret-token") !==
			expectedSecret
	) {
		return new Response("Unauthorized", { status: 401 });
	}

	let update: TelegramUpdate;
	try {
		update = (await request.json()) as TelegramUpdate;
	} catch {
		return new Response("Bad Request", { status: 400 });
	}

	// Return 200 immediately so Telegram doesn't retry on slow commands like /sync
	void handleTelegramUpdate(update).catch((error) => {
		logger.error("[telegram] Update handling failed", {
			updateId: update.update_id,
			error: error instanceof Error ? error.message : String(error),
		});
	});

	return new Response("OK");
}
