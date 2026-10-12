import { orpcClient } from "@shared/lib/orpc-client";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

/** Hard cap on a single recording, matched by the backend's payload-size cap. */
const MAX_RECORDING_SECONDS = 120;

/** In priority order — Safari doesn't support audio/webm, so fall back. */
const CANDIDATE_MIME_TYPES = [
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/mp4",
	"audio/ogg",
];

function pickSupportedMimeType(): string | null {
	if (typeof MediaRecorder === "undefined") {
		return null;
	}
	return (
		CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ??
		null
	);
}

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onloadend = () => {
			const result = reader.result as string;
			// Strip the "data:audio/webm;base64," prefix — only the raw
			// base64 payload goes to the backend.
			resolve(result.split(",")[1] ?? "");
		};
		reader.onerror = reject;
		reader.readAsDataURL(blob);
	});
}

export function formatElapsed(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

export type RecordingState = "idle" | "recording" | "transcribing";

/**
 * Click-to-start/click-to-stop voice recording that transcribes via the
 * server-side Gemini transcription endpoint (no browser SpeechRecognition).
 * `onTranscript` receives the resolved text once transcription succeeds —
 * callers decide whether to append it to existing input or replace it.
 *
 * `endpoint` selects which oRPC procedure transcribes the recording.
 * "authenticated" (default) is the pro inbox composer, subject to the plan's
 * voice-minutes cap; "public" is the free marketing homepage demo, uncapped
 * but per-user rate-limited; both require a signed-in session. "anonymous"
 * is the signed-out marketing homepage demo — no session, IP rate-limited.
 */
export function useVoiceRecording(
	onTranscript: (text: string) => void,
	endpoint: "authenticated" | "public" | "anonymous" = "authenticated",
) {
	const [recordingState, setRecordingState] =
		useState<RecordingState>("idle");
	const [elapsedSeconds, setElapsedSeconds] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);
	const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const stopRecordingAndCleanupTimers = () => {
		if (recordingTimerRef.current) {
			clearInterval(recordingTimerRef.current);
		}
		if (autoStopTimerRef.current) {
			clearTimeout(autoStopTimerRef.current);
		}
		recordingTimerRef.current = null;
		autoStopTimerRef.current = null;
	};

	const stopRecording = async () => {
		const recorder = mediaRecorderRef.current;
		if (!recorder || recordingState !== "recording") {
			return;
		}

		stopRecordingAndCleanupTimers();
		setRecordingState("transcribing");

		const stopped = new Promise<void>((resolve) => {
			recorder.addEventListener("stop", () => resolve(), {
				once: true,
			});
		});
		recorder.stop();
		await stopped;

		const blob = new Blob(audioChunksRef.current, {
			type: recorder.mimeType,
		});
		audioChunksRef.current = [];

		if (blob.size === 0) {
			toast.error("No audio was recorded. Please try again.");
			setRecordingState("idle");
			return;
		}

		try {
			const base64 = await blobToBase64(blob);
			// Strip the codec suffix (e.g. ";codecs=opus") — the backend's
			// mediaType enum expects only the base MIME type.
			const mediaType = recorder.mimeType.split(";")[0] as
				| "audio/webm"
				| "audio/mp4"
				| "audio/wav"
				| "audio/ogg";
			const { text } =
				endpoint === "anonymous"
					? await orpcClient.ai.transcribeVoiceAnonymous({
							audio: base64,
							mediaType,
						})
					: endpoint === "public"
						? await orpcClient.ai.transcribeVoiceDemo({
								audio: base64,
								mediaType,
							})
						: await orpcClient.ai.transcribeVoice({
								audio: base64,
								mediaType,
							});
			onTranscript(text);
		} catch (err) {
			toast.error(
				err instanceof Error
					? err.message
					: "Could not transcribe the recording",
			);
		} finally {
			setRecordingState("idle");
		}
	};

	const startRecording = async () => {
		if (recordingState !== "idle") {
			return;
		}

		const mimeType = pickSupportedMimeType();
		if (!mimeType) {
			toast.error("Voice recording isn't supported in this browser.");
			return;
		}

		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
		} catch {
			toast.error(
				"Microphone access was denied. Enable it in your browser settings to use voice input.",
			);
			return;
		}

		audioChunksRef.current = [];
		const recorder = new MediaRecorder(stream, { mimeType });
		mediaRecorderRef.current = recorder;

		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) {
				audioChunksRef.current.push(e.data);
			}
		};
		recorder.onstop = () => {
			// Release the mic so the browser's recording indicator clears.
			for (const track of stream.getTracks()) {
				track.stop();
			}
		};

		recorder.start();
		setRecordingState("recording");
		setElapsedSeconds(0);

		recordingTimerRef.current = setInterval(() => {
			setElapsedSeconds((s) => s + 1);
		}, 1000);

		autoStopTimerRef.current = setTimeout(() => {
			stopRecording();
		}, MAX_RECORDING_SECONDS * 1000);
	};

	useEffect(() => {
		return () => {
			stopRecordingAndCleanupTimers();
			for (const track of mediaRecorderRef.current?.stream.getTracks() ??
				[]) {
				track.stop();
			}
		};
	}, []);

	return { recordingState, elapsedSeconds, startRecording, stopRecording };
}
