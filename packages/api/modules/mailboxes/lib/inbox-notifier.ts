// In-process pub/sub for SSE inbox notifications.
// Maps mailboxId → (connectionId → stream controller).
const channels = new Map<
	string,
	Map<string, ReadableStreamDefaultController>
>();

export function subscribeToMailbox(
	mailboxId: string,
	ctrl: ReadableStreamDefaultController,
): () => void {
	if (!channels.has(mailboxId)) {
		channels.set(mailboxId, new Map());
	}
	const id = crypto.randomUUID();
	channels.get(mailboxId)?.set(id, ctrl);
	return () => channels.get(mailboxId)?.delete(id);
}

export function notifyMailboxClients(mailboxId: string): void {
	const subs = channels.get(mailboxId);
	if (!subs?.size) {
		return;
	}
	const payload = new TextEncoder().encode("data: new-mail\n\n");
	for (const ctrl of subs.values()) {
		try {
			ctrl.enqueue(payload);
		} catch {
			// controller is closed — subscriber cleanup will remove it
		}
	}
}
