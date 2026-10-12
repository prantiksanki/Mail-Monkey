import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "@repo/logs";
import { deleteZoomAccountsByZoomUserId } from "../lib/zoom-client";

// Zoom signs every webhook (including endpoint validation) as
// `v0=HMAC_SHA256(secretToken, "v0:<x-zm-request-timestamp>:<raw body>")`.
const SIGNATURE_VERSION = "v0";
// Reject requests whose timestamp is further than this from now, so a captured
// request can't be replayed later.
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

interface ZoomWebhookBody {
	event?: string;
	payload?: {
		plainToken?: string;
		user_id?: string;
		account_id?: string;
		client_id?: string;
	};
}

function hmacHex(secret: string, message: string): string {
	return createHmac("sha256", secret).update(message).digest("hex");
}

function isValidSignature(
	req: Request,
	rawBody: string,
	secret: string,
): boolean {
	const signature = req.headers.get("x-zm-signature");
	const timestamp = req.headers.get("x-zm-request-timestamp");
	if (!signature || !timestamp) {
		return false;
	}

	const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
	if (
		!Number.isFinite(ageSeconds) ||
		ageSeconds > TIMESTAMP_TOLERANCE_SECONDS
	) {
		return false;
	}

	const expected = `${SIGNATURE_VERSION}=${hmacHex(
		secret,
		`${SIGNATURE_VERSION}:${timestamp}:${rawBody}`,
	)}`;
	const expectedBuffer = Buffer.from(expected);
	const receivedBuffer = Buffer.from(signature);
	return (
		expectedBuffer.length === receivedBuffer.length &&
		timingSafeEqual(expectedBuffer, receivedBuffer)
	);
}

/**
 * Zoom Marketplace webhook endpoint (`POST /api/webhooks/zoom`). Used as both the
 * event-notification and the Deauthorization Notification URL:
 *  - `endpoint.url_validation` → answers Zoom's challenge-response check
 *  - `app_deauthorized`        → the user uninstalled the app on the Zoom side, so
 *                                we delete their stored Zoom tokens (Zoom requires
 *                                apps to delete user data on deauthorization)
 *
 * The signature is verified before anything else, including the validation
 * challenge — otherwise the challenge would act as an HMAC oracle for forging
 * signed requests.
 */
export async function zoomWebhookHandler(req: Request): Promise<Response> {
	const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
	if (!secret) {
		logger.error(
			"[zoom-webhook] ZOOM_WEBHOOK_SECRET_TOKEN is not configured",
		);
		return new Response("Webhook not configured", { status: 503 });
	}

	const rawBody = await req.text();
	if (!isValidSignature(req, rawBody, secret)) {
		logger.warn("[zoom-webhook] Rejected request with invalid signature");
		return new Response("Invalid signature", { status: 401 });
	}

	let body: ZoomWebhookBody;
	try {
		body = JSON.parse(rawBody);
	} catch {
		return new Response("Invalid JSON", { status: 400 });
	}

	if (body.event === "endpoint.url_validation") {
		const plainToken = body.payload?.plainToken;
		if (!plainToken) {
			return new Response("Missing plainToken", { status: 400 });
		}
		return Response.json({
			plainToken,
			encryptedToken: hmacHex(secret, plainToken),
		});
	}

	if (body.event === "app_deauthorized") {
		const zoomUserId = body.payload?.user_id;
		if (!zoomUserId) {
			return new Response("Missing user_id", { status: 400 });
		}

		// Ignore notifications meant for a different Zoom app (e.g. a sandbox
		// app sharing the same endpoint).
		const clientId = process.env.ZOOM_CLIENT_ID;
		if (
			clientId &&
			body.payload?.client_id &&
			body.payload.client_id !== clientId
		) {
			logger.warn(
				"[zoom-webhook] Ignoring deauthorization for other app",
			);
			return new Response("OK", { status: 200 });
		}

		try {
			const removed = await deleteZoomAccountsByZoomUserId(zoomUserId);
			logger.info("[zoom-webhook] Zoom app deauthorized", { removed });
		} catch (error) {
			logger.error("[zoom-webhook] Failed to remove Zoom account", {
				error: error instanceof Error ? error.message : String(error),
			});
			// Non-2xx so Zoom retries the deauthorization.
			return new Response("Internal error", { status: 500 });
		}
		return new Response("OK", { status: 200 });
	}

	// Any other subscribed event: acknowledge so Zoom doesn't retry.
	return new Response("OK", { status: 200 });
}
