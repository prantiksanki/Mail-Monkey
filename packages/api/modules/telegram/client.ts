import { logger } from "@repo/logs";

type TelegramApiResponse<T> =
	| { ok: true; result: T }
	| { ok: false; description?: string; error_code?: number };

export type InlineKeyboardMarkup = {
	inline_keyboard: Array<
		Array<
			| {
					text: string;
					callback_data: string;
			  }
			| {
					text: string;
					url: string;
			  }
		>
	>;
};

function getBotToken() {
	const token = process.env.TELEGRAM_BOT_TOKEN;
	if (!token) {
		throw new Error("TELEGRAM_BOT_TOKEN is not configured");
	}
	return token;
}

async function telegramRequest<T>(
	method: string,
	payload: Record<string, unknown>,
): Promise<T> {
	const response = await fetch(
		`https://api.telegram.org/bot${getBotToken()}/${method}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		},
	);

	const body = (await response
		.json()
		.catch(() => null)) as TelegramApiResponse<T> | null;

	if (!response.ok || !body?.ok) {
		const description =
			body && "description" in body
				? body.description
				: `HTTP ${response.status}`;
		logger.error("[telegram] Bot API request failed", {
			method,
			status: response.status,
			description,
		});
		throw new Error(`Telegram ${method} failed: ${description}`);
	}

	return body.result;
}

export async function sendTelegramMessage(
	chatId: string,
	text: string,
	options: {
		replyMarkup?: InlineKeyboardMarkup;
		disableWebPagePreview?: boolean;
	} = {},
) {
	return telegramRequest("sendMessage", {
		chat_id: chatId,
		text: text.slice(0, 4096),
		disable_web_page_preview: options.disableWebPagePreview ?? true,
		...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
	});
}

export async function answerTelegramCallbackQuery(
	callbackQueryId: string,
	text?: string,
) {
	return telegramRequest("answerCallbackQuery", {
		callback_query_id: callbackQueryId,
		...(text ? { text } : {}),
	});
}

export async function editTelegramMessageReplyMarkup(input: {
	chatId: string;
	messageId: number;
	replyMarkup?: InlineKeyboardMarkup;
}) {
	return telegramRequest("editMessageReplyMarkup", {
		chat_id: input.chatId,
		message_id: input.messageId,
		reply_markup: input.replyMarkup ?? { inline_keyboard: [] },
	});
}

export async function setTelegramWebhook(url: string) {
	return telegramRequest("setWebhook", {
		url,
		allowed_updates: ["message", "callback_query"],
		drop_pending_updates: true,
		...(process.env.TELEGRAM_WEBHOOK_SECRET
			? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }
			: {}),
	});
}

export async function deleteTelegramWebhook() {
	return telegramRequest("deleteWebhook", {
		drop_pending_updates: true,
	});
}
