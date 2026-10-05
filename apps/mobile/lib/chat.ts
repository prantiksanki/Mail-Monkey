import AsyncStorage from "@react-native-async-storage/async-storage";

export type ChatMessage = {
	role: "user" | "assistant";
	content: string;
	sources?: { from: string; subject: string }[];
};

export type ChatThread = {
	id: string;
	title: string;
	messages: ChatMessage[];
	updatedAt: number;
};

const KEY = "monkeychan_threads";

export async function getThreads(): Promise<ChatThread[]> {
	const v = await AsyncStorage.getItem(KEY);
	try {
		return v ? (JSON.parse(v) as ChatThread[]) : [];
	} catch {
		return [];
	}
}

export async function saveThread(thread: ChatThread): Promise<void> {
	const threads = await getThreads();
	const idx = threads.findIndex((t) => t.id === thread.id);
	if (idx >= 0) threads[idx] = thread;
	else threads.push(thread);
	threads.sort((a, b) => b.updatedAt - a.updatedAt);
	await AsyncStorage.setItem(KEY, JSON.stringify(threads.slice(0, 50)));
}

export async function deleteThread(id: string): Promise<void> {
	const threads = (await getThreads()).filter((t) => t.id !== id);
	await AsyncStorage.setItem(KEY, JSON.stringify(threads));
}

// Grab @mentions (e.g. "@Sarah") so the backend can scope retrieval by sender.
export function parseMentions(text: string): string[] {
	const matches = text.match(/@([\p{L}\w.]+)/gu) ?? [];
	return [...new Set(matches.map((m) => m.slice(1)))];
}
