"use client";

import { cn } from "@repo/ui";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { useSession } from "@saas/auth/hooks/use-session";
import {
	formatElapsed,
	useVoiceRecording,
} from "@shared/hooks/use-voice-recording";
import { orpcClient } from "@shared/lib/orpc-client";
import { motion } from "framer-motion";
import {
	BriefcaseIcon,
	CheckIcon,
	CoffeeIcon,
	CopyIcon,
	HeartIcon,
	Loader2Icon,
	MailIcon,
	ScrollTextIcon,
	SparklesIcon,
} from "lucide-react";
import NextLink from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LoginPromptIllustration } from "./LoginPromptIllustration";
import { type RibbonPhase, SpeechRibbon } from "./SpeechRibbon";
import { WaveformCapsule, type WaveformState } from "./WaveformCapsule";

const TONES = [
	{ key: "professional", label: "Professional", icon: BriefcaseIcon },
	{ key: "casual", label: "Casual", icon: CoffeeIcon },
	{ key: "formal", label: "Formal", icon: ScrollTextIcon },
	{ key: "friendly", label: "Friendly", icon: HeartIcon },
] as const;

type Tone = (typeof TONES)[number]["key"];

interface GeneratedDraft {
	tone: Tone;
	subject: string;
	body: string;
}

/** Words per tick for the curved-trail reveal after transcription lands. */
const REVEAL_INTERVAL_MS = 55;
/** Characters per tick for the email typewriter. */
const TYPE_CHARS_PER_TICK = 3;
const TYPE_INTERVAL_MS = 16;

function splitWords(text: string): string[] {
	const trimmed = text.trim();
	return trimmed ? trimmed.split(/\s+/) : [];
}

export function SpeakYourMind() {
	const { user, loaded: sessionLoaded } = useSession();
	const [tone, setTone] = useState<Tone>("professional");
	const [transcript, setTranscript] = useState("");
	const [drafts, setDrafts] = useState<GeneratedDraft[] | null>(null);
	const [generating, setGenerating] = useState(false);
	const [revealedCount, setRevealedCount] = useState(0);
	const [typedBody, setTypedBody] = useState("");
	const [showEditor, setShowEditor] = useState(false);
	const [copied, setCopied] = useState(false);
	const [showLoginPrompt, setShowLoginPrompt] = useState(false);

	// Transcript we've already sent to the composer — blocks the auto-generate
	// effect from firing twice for the same take.
	const generatedForRef = useRef("");
	const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const { recordingState, elapsedSeconds, startRecording, stopRecording } =
		useVoiceRecording(
			(text) => {
				// A fresh utterance invalidates the previous email.
				setDrafts(null);
				setTypedBody("");
				setShowLoginPrompt(false);
				generatedForRef.current = "";
				setTranscript((prev) =>
					prev.trim() ? `${prev.trim()} ${text}` : text,
				);
			},
			user ? "public" : "anonymous",
		);

	function handleMicToggle() {
		if (isRecording) {
			stopRecording();
			return;
		}
		startRecording();
	}

	const isRecording = recordingState === "recording";
	const isTranscribing = recordingState === "transcribing";
	const words = useMemo(() => splitWords(transcript), [transcript]);
	const activeDraft = drafts?.find((d) => d.tone === tone) ?? null;

	// Reveal the transcript word-by-word along the curved trail.
	useEffect(() => {
		if (revealedCount >= words.length) {
			return;
		}
		const id = setInterval(() => {
			setRevealedCount((c) => Math.min(c + 1, words.length));
		}, REVEAL_INTERVAL_MS);
		return () => clearInterval(id);
	}, [words.length, revealedCount]);

	// Once the trail has caught up to a spoken take, compose the email.
	useEffect(() => {
		if (
			recordingState !== "idle" ||
			showEditor ||
			generating ||
			!sessionLoaded ||
			words.length === 0 ||
			revealedCount < words.length ||
			generatedForRef.current === transcript.trim()
		) {
			return;
		}
		void handleGenerate();
	}, [
		recordingState,
		showEditor,
		generating,
		sessionLoaded,
		words.length,
		revealedCount,
		transcript,
	]);

	// Typewriter for the active draft body.
	useEffect(() => {
		if (!activeDraft) {
			setTypedBody("");
			return;
		}
		const full = activeDraft.body;
		let i = 0;
		setTypedBody("");
		const id = setInterval(() => {
			i += TYPE_CHARS_PER_TICK;
			setTypedBody(full.slice(0, i));
			if (i >= full.length) {
				clearInterval(id);
			}
		}, TYPE_INTERVAL_MS);
		return () => clearInterval(id);
	}, [activeDraft]);

	async function handleGenerate() {
		const value = transcript.trim();
		if (!value || generating) {
			return;
		}
		setGenerating(true);
		setDrafts(null);
		setTypedBody("");
		generatedForRef.current = value;
		try {
			const result = user
				? await orpcClient.ai.composeVoiceEmail({ transcript: value })
				: await orpcClient.ai.composeVoiceEmailAnonymous({
						transcript: value,
					});
			setDrafts(result.drafts as GeneratedDraft[]);
			setTone("professional");
		} catch (err) {
			generatedForRef.current = "";
			toast.error(
				err instanceof Error
					? err.message
					: "Could not generate the email",
			);
		} finally {
			setGenerating(false);
		}
	}

	function handleCopyEmail() {
		if (!activeDraft) {
			return;
		}
		if (!user) {
			setShowLoginPrompt(true);
			return;
		}
		if (copyTimeoutRef.current) {
			clearTimeout(copyTimeoutRef.current);
		}
		navigator.clipboard
			.writeText(`Subject: ${activeDraft.subject}\n\n${activeDraft.body}`)
			.catch(() => {});
		setCopied(true);
		copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
	}

	function handleReset() {
		setTranscript("");
		setRevealedCount(0);
		setDrafts(null);
		setTypedBody("");
		setShowEditor(false);
		setShowLoginPrompt(false);
		generatedForRef.current = "";
	}

	function handleEditorChange(value: string) {
		setTranscript(value);
		setRevealedCount(splitWords(value).length);
		setDrafts(null);
		setTypedBody("");
		setShowLoginPrompt(false);
		generatedForRef.current = "";
	}

	const capsuleState: WaveformState = isRecording
		? "listening"
		: isTranscribing
			? "processing"
			: "idle";

	const ribbonPhase: RibbonPhase = isRecording
		? "listening"
		: isTranscribing
			? "processing"
			: revealedCount < words.length
				? "revealing"
				: words.length > 0
					? "done"
					: "idle";

	const isTyping =
		!!activeDraft && typedBody.length < activeDraft.body.length;

	return (
		<section className="relative w-full overflow-hidden border-t border-border bg-background px-6 py-24 text-center sm:px-8">
			<span className="inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
				AI voice interface
			</span>
			<h2 className="mx-auto mt-6 max-w-[20ch] font-[family-name:var(--font-bricolage)] text-[clamp(38px,7vw,64px)] font-extrabold leading-[1.02] tracking-[-0.02em] text-foreground">
				Don&rsquo;t type,{" "}
				<span className="font-[family-name:var(--font-instrument)] font-normal italic text-primary">
					just speak.
				</span>
			</h2>
			<p className="mx-auto mt-5 max-w-[46ch] text-[18px] leading-[1.55] text-muted-foreground">
				Ramble into the mic. Popsuites strips the filler words, fixes
				the typos, and writes the email for you &mdash; in the tone you
				pick.
			</p>

			<div className="mx-auto mt-8 flex max-w-[560px] flex-wrap justify-center gap-2">
				{TONES.map(({ key, label, icon: Icon }) => (
					<button
						key={key}
						type="button"
						onClick={() => setTone(key)}
						disabled={generating}
						className={cn(
							"flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50",
							tone === key
								? "border-primary bg-primary/10 text-primary-deep"
								: "border-border bg-card text-foreground hover:bg-muted",
						)}
					>
						<Icon className="size-4" />
						{label}
					</button>
				))}
			</div>

			<div className="relative mx-auto mt-10 max-w-[1100px]">
				<SpeechRibbon
					words={words}
					revealedCount={revealedCount}
					phase={ribbonPhase}
				/>

				<div className="relative z-[2] -mt-2 flex flex-col items-center gap-4">
					<WaveformCapsule
						state={capsuleState}
						elapsedLabel={formatElapsed(elapsedSeconds)}
						disabled={isTranscribing}
						onToggle={handleMicToggle}
					/>

					<p className="-mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						Speech-to-text powered by Sarvam
					</p>

					<div className="flex items-center gap-3 text-[13px] text-muted-foreground">
						<button
							type="button"
							onClick={() => setShowEditor((v) => !v)}
							className="underline-offset-4 hover:underline"
						>
							{showEditor ? "Hide text" : "Type instead"}
						</button>
						{words.length > 0 && (
							<>
								<span className="text-border">|</span>
								<button
									type="button"
									onClick={handleReset}
									className="underline-offset-4 hover:underline"
								>
									Start over
								</button>
							</>
						)}
					</div>

					{showEditor && (
						<div className="w-full max-w-[640px] text-left">
							<textarea
								value={transcript}
								onChange={(e) =>
									handleEditorChange(e.target.value)
								}
								rows={4}
								placeholder="Type or edit your rambled thought…"
								className="w-full resize-none rounded-2xl border border-border bg-card p-4 text-[15px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
							/>
							<button
								type="button"
								onClick={() => void handleGenerate()}
								disabled={!transcript.trim() || generating}
								className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
							>
								{generating ? (
									<Loader2Icon className="size-4 animate-spin" />
								) : (
									<SparklesIcon className="size-4" />
								)}
								Generate email
							</button>
						</div>
					)}
				</div>
			</div>

			{(generating || drafts) && (
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
					className="mx-auto mt-12 max-w-[680px] text-left"
				>
					<div className="rounded-[1.5rem] border border-border bg-card p-6 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.25)]">
						<div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
							<span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<MailIcon className="size-4" />
							</span>
							<div className="min-w-0 flex-1">
								<p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
									{!drafts
										? "Composing"
										: isTyping
											? "Writing…"
											: "Ready to send"}
								</p>
								<p className="truncate font-medium text-foreground">
									{activeDraft?.subject || "Your email"}
								</p>
							</div>

							{drafts && (
								<button
									type="button"
									onClick={handleCopyEmail}
									aria-label="Copy email to clipboard"
									className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-[13px] text-foreground transition hover:border-border-strong"
								>
									<span>{copied ? "Copied!" : "Copy"}</span>
									<span className="relative size-4 shrink-0">
										<CopyIcon
											className={cn(
												"absolute inset-0 size-4",
												copied && "animate-fade-out",
											)}
										/>
										<CheckIcon
											className={cn(
												"absolute inset-0 size-4 text-primary opacity-0",
												copied && "animate-fade-in",
											)}
										/>
									</span>
								</button>
							)}
						</div>

						{generating && !drafts ? (
							<div className="flex items-center gap-3 py-6 text-muted-foreground">
								<Loader2Icon className="size-4 animate-spin text-primary" />
								<span className="text-[13px]">
									Writing your email…
								</span>
							</div>
						) : (
							<p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
								{typedBody}
								{isTyping && (
									<span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] animate-pulse bg-primary align-middle" />
								)}
							</p>
						)}
					</div>
				</motion.div>
			)}

			<Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
				<DialogContent
					className="max-w-[420px] overflow-hidden border-none p-0 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)]"
					style={{ borderRadius: "42px 42px 30px 30px" }}
				>
					<div className="relative overflow-hidden bg-linear-to-b from-primary/15 via-primary/5 to-transparent px-8 pt-9 pb-3">
						<div
							className="-top-10 -right-10 absolute size-32 rounded-full bg-primary/20 blur-2xl"
							aria-hidden="true"
						/>
						<div
							className="-left-8 absolute top-6 size-20 rounded-full bg-primary/10 blur-2xl"
							aria-hidden="true"
						/>
						<LoginPromptIllustration className="relative mx-auto h-[180px] w-full max-w-[220px]" />
					</div>

					<div className="px-8 pt-3 pb-1">
						<DialogTitle className="font-[family-name:var(--font-bricolage)] text-[22px] font-extrabold tracking-[-0.01em]">
							Sign up to copy your email
						</DialogTitle>
						<DialogDescription className="mx-auto mt-2 max-w-[30ch] text-[14px] leading-relaxed">
							Your email is ready &mdash; create a free account to
							copy it and keep using Popsuites.
						</DialogDescription>
					</div>

					<div className="flex gap-3 p-6 pt-5">
						<button
							type="button"
							onClick={() => setShowLoginPrompt(false)}
							className="flex-1 rounded-full border border-border bg-transparent px-5 py-2.5 text-center text-sm font-medium text-foreground transition-colors hover:bg-muted"
						>
							Cancel
						</button>
						<NextLink
							href="/auth/signup"
							className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-[0_10px_25px_-8px_var(--color-primary)] transition-colors hover:bg-primary/90"
						>
							<SparklesIcon className="size-4" />
							Sign up
						</NextLink>
					</div>
				</DialogContent>
			</Dialog>
		</section>
	);
}
