"use client";

import { Dialog, DialogContent, DialogTitle } from "@repo/ui/components/dialog";
import {
	formatElapsed,
	useVoiceRecording,
} from "@shared/hooks/use-voice-recording";
import { Loader2Icon, MicIcon } from "lucide-react";
import { useEffect, useRef } from "react";

interface VoiceListeningOverlayProps {
	open: boolean;
	onClose: () => void;
	/** Receives the transcribed text once recording stops and transcription succeeds. */
	onTranscript: (text: string) => void;
}

/**
 * Full-screen, centered "Listening…" overlay for voice input, modeled after
 * Google/YouTube's voice search UI. Recording starts as soon as the dialog
 * opens and stops when the user taps the mic again or closes the dialog.
 */
export function VoiceListeningOverlay({
	open,
	onClose,
	onTranscript,
}: VoiceListeningOverlayProps) {
	const { recordingState, elapsedSeconds, startRecording, stopRecording } =
		useVoiceRecording((text) => {
			if (text.trim()) {
				onTranscript(text);
			}
			onClose();
		});

	// Avoids starting a second recording if this effect re-fires while one
	// is already in flight (e.g. StrictMode double-invoke in dev).
	const startedRef = useRef(false);

	useEffect(() => {
		if (open && !startedRef.current) {
			startedRef.current = true;
			startRecording();
		}
		if (!open) {
			startedRef.current = false;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const handleOpenChange = (next: boolean) => {
		if (!next) {
			if (recordingState === "recording") {
				stopRecording();
			}
			onClose();
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="flex max-w-sm flex-col items-center gap-6 border-none bg-background/95 py-10 text-center shadow-2xl backdrop-blur-xl">
				<DialogTitle className="sr-only">Voice input</DialogTitle>

				<p className="text-sm font-medium text-muted-foreground">
					{recordingState === "transcribing"
						? "Transcribing…"
						: "Listening…"}
				</p>

				<button
					type="button"
					onClick={stopRecording}
					disabled={recordingState !== "recording"}
					aria-label="Stop recording"
					className="group relative flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform disabled:cursor-default"
				>
					{recordingState === "recording" && (
						<span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/40" />
					)}
					{recordingState === "transcribing" ? (
						<Loader2Icon className="size-8 animate-spin" />
					) : (
						<MicIcon className="size-8" />
					)}
				</button>

				<span className="text-xs text-muted-foreground">
					{recordingState === "recording"
						? formatElapsed(elapsedSeconds)
						: "Tap the mic to stop"}
				</span>
			</DialogContent>
		</Dialog>
	);
}
