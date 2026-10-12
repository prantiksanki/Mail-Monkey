"use client";

import { cn } from "@repo/ui";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Spinner } from "@repo/ui/components/spinner";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { useSidebar } from "@saas/shared/lib/sidebar-context";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import {
	BrainIcon,
	CodeIcon,
	type LucideIcon,
	MessageSquareIcon,
	MicIcon,
	SparklesIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	useConversationQuery,
	useCreateConversationMutation,
	useRenameConversationMutation,
} from "../lib/ai-assistant-api";
import { ChatView } from "./ChatView";
import { ConversationList } from "./ConversationList";
import { VoiceListeningOverlay } from "./VoiceListeningOverlay";

interface AssistantPersona {
	id: string;
	name: string;
	role: string;
	icon: LucideIcon;
	gradient: string;
	statusClass: string;
}

// Visual-only personas: this app runs a single real assistant backed by one
// model. The picker exists for design parity with the target widget and
// intentionally does not change what the assistant does.
const ASSISTANT_PERSONAS: AssistantPersona[] = [
	{
		id: "gpt4",
		name: "GPT-4",
		role: "Advanced Reasoning",
		icon: SparklesIcon,
		gradient: "from-primary/25 to-primary/5",
		statusClass: "bg-emerald-500",
	},
	{
		id: "claude",
		name: "Claude 3.5",
		role: "Creative Writing",
		icon: BrainIcon,
		gradient: "from-blue-500/25 to-blue-500/5",
		statusClass: "bg-emerald-500",
	},
	{
		id: "gemini",
		name: "Gemini Pro",
		role: "Multimodal Analysis",
		icon: ZapIcon,
		gradient: "from-purple-500/25 to-purple-500/5",
		statusClass: "bg-amber-500",
	},
	{
		id: "copilot",
		name: "Copilot",
		role: "Code Assistant",
		icon: CodeIcon,
		gradient: "from-teal-500/25 to-teal-500/5",
		statusClass: "bg-emerald-500",
	},
];

const containerVariants: Variants = {
	hidden: {
		opacity: 0,
		y: 20,
		scale: 0.95,
		transformOrigin: "bottom right",
	},
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: {
			type: "spring",
			damping: 25,
			stiffness: 300,
		},
	},
	exit: {
		opacity: 0,
		y: 20,
		scale: 0.95,
		transition: {
			duration: 0.2,
		},
	},
};

const launcherOptionVariants: Variants = {
	hidden: { opacity: 0, y: 8, scale: 0.9 },
	visible: { opacity: 1, y: 0, scale: 1 },
	exit: { opacity: 0, y: 8, scale: 0.9, transition: { duration: 0.15 } },
};

export function AiAssistantWidget() {
	const { selectedMailboxId } = useSelectedMailbox();
	const { isMobileOpen } = useSidebar();
	const [open, setOpen] = useState(false);
	// Whether the launcher is showing the "Voice input" / "Text input" choices.
	const [launcherExpanded, setLauncherExpanded] = useState(false);
	const [voiceOpen, setVoiceOpen] = useState(false);
	const [personaId, setPersonaId] = useState(ASSISTANT_PERSONAS[0].id);
	// null → conversation list; string → an open conversation.
	const [activeId, setActiveId] = useState<string | null>(null);
	// True for a freshly created chat so we start ChatView with no messages
	// instead of waiting on a (guaranteed empty) fetch.
	const [isNew, setIsNew] = useState(false);
	// Transcript from the voice overlay, handed to ChatView as its starting input.
	const [pendingVoiceInput, setPendingVoiceInput] = useState("");

	// The selected mailbox comes from localStorage, so it's only known on the
	// client. Gate rendering on mount to avoid a server/client hydration
	// mismatch on the floating button.
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);

	const createMutation = useCreateConversationMutation(selectedMailboxId);
	const renameMutation = useRenameConversationMutation(selectedMailboxId);
	const { data: conversationData, isLoading: conversationLoading } =
		useConversationQuery(!isNew ? activeId : null);

	// Don't render until mounted (avoids hydration mismatch), until a mailbox
	// is available to scope to, or while the mobile nav drawer is open (the
	// drawer can be as wide as the viewport on small screens, which would
	// otherwise sit right under the launcher button).
	if (!mounted || !selectedMailboxId || isMobileOpen) {
		return null;
	}

	const currentPersona =
		ASSISTANT_PERSONAS.find((p) => p.id === personaId) ??
		ASSISTANT_PERSONAS[0];
	const PersonaIcon = currentPersona.icon;

	const startNewChat = () => {
		createMutation.mutate(undefined, {
			onSuccess: (res) => {
				setIsNew(true);
				setActiveId(res.conversation.id);
			},
			onError: () => toast.error("Couldn't start a new chat"),
		});
	};

	const openConversation = (id: string) => {
		setIsNew(false);
		setActiveId(id);
		setPendingVoiceInput("");
	};

	const backToList = () => {
		setActiveId(null);
		setIsNew(false);
		setPendingVoiceInput("");
	};

	const handleFirstMessage = (text: string) => {
		if (activeId) {
			// Auto-title the thread from the first thing the user asked.
			renameMutation.mutate({
				id: activeId,
				title: text.slice(0, 60),
			});
		}
	};

	const openTextInput = () => {
		setLauncherExpanded(false);
		setOpen(true);
	};

	const openVoiceInput = () => {
		setLauncherExpanded(false);
		setVoiceOpen(true);
	};

	// A transcript always starts a fresh conversation prefilled with what was
	// said, so the user reviews it in the composer before sending.
	const handleVoiceTranscript = (text: string) => {
		setPendingVoiceInput(text);
		setOpen(true);
		createMutation.mutate(undefined, {
			onSuccess: (res) => {
				setIsNew(true);
				setActiveId(res.conversation.id);
			},
			onError: () => toast.error("Couldn't start a new chat"),
		});
	};

	const renderBody = () => {
		if (!activeId) {
			return (
				<ConversationList
					mailboxId={selectedMailboxId}
					onNewChat={startNewChat}
					onOpen={openConversation}
				/>
			);
		}

		if (!isNew && conversationLoading) {
			return (
				<div className="flex h-full items-center justify-center">
					<Spinner className="size-6 text-muted-foreground" />
				</div>
			);
		}

		return (
			<ChatView
				key={activeId}
				mailboxId={selectedMailboxId}
				conversationId={activeId}
				initialMessages={
					isNew ? [] : (conversationData?.messages ?? [])
				}
				initialInput={pendingVoiceInput}
				onBack={backToList}
				onFirstMessage={handleFirstMessage}
				onNavigateAway={() => setOpen(false)}
			/>
		);
	};

	return (
		<div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-4">
			<AnimatePresence>
				{open && (
					<motion.div
						key="ai-assistant-panel"
						variants={containerVariants}
						initial="hidden"
						animate="visible"
						exit="exit"
						className="flex h-[560px] w-[380px] flex-col overflow-hidden rounded-2xl border border-border/40 bg-background/70 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:ring-white/10"
					>
						{/* Persona header (visual identity — see ASSISTANT_PERSONAS note above) */}
						<div className="relative shrink-0 overflow-hidden border-b border-border/40 bg-muted/30 p-4">
							<div
								className={cn(
									"absolute inset-0 bg-gradient-to-br opacity-60",
									currentPersona.gradient,
								)}
							/>
							<div className="relative z-10 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<div className="relative">
										<Avatar className="size-10 rounded-full border-2 border-background shadow-sm">
											<AvatarFallback className="rounded-full bg-primary/10 text-primary">
												<PersonaIcon className="size-4" />
											</AvatarFallback>
										</Avatar>
										<span
											className={cn(
												"absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background",
												currentPersona.statusClass,
											)}
										/>
									</div>
									<div>
										<h3 className="text-sm font-semibold text-foreground">
											{currentPersona.name}
										</h3>
										<span className="text-xs text-muted-foreground">
											{currentPersona.role}
										</span>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setOpen(false)}
									aria-label="Close"
									className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/50 hover:text-foreground"
								>
									<XIcon className="size-4" />
								</button>
							</div>
						</div>

						{/* Persona picker — visual only, doesn't change the assistant's behavior */}
						<div className="shrink-0 border-b border-border/40 p-2">
							<Select
								value={personaId}
								onValueChange={setPersonaId}
							>
								<SelectTrigger className="h-auto w-full cursor-pointer border-none bg-transparent px-2 py-2.5 shadow-none hover:bg-accent/50 focus:ring-0 focus:ring-offset-0">
									<SelectValue />
								</SelectTrigger>
								<SelectContent className="border-border/40 bg-popover/95 backdrop-blur-xl">
									{ASSISTANT_PERSONAS.map((persona) => {
										const Icon = persona.icon;
										return (
											<SelectItem
												key={persona.id}
												value={persona.id}
												className="cursor-pointer"
											>
												<div className="flex items-center gap-2.5 py-0.5">
													<span
														className={cn(
															"flex size-7 items-center justify-center rounded-lg bg-gradient-to-br",
															persona.gradient,
														)}
													>
														<Icon className="size-3.5 text-foreground/80" />
													</span>
													<div className="flex flex-col text-left">
														<span className="text-sm font-medium">
															{persona.name}
														</span>
														<span className="text-[10px] text-muted-foreground">
															{persona.role}
														</span>
													</div>
												</div>
											</SelectItem>
										);
									})}
								</SelectContent>
							</Select>
						</div>

						{/* Real assistant body — conversation list or an open chat */}
						<div className="min-h-0 flex-1 bg-gradient-to-b from-background/10 to-background/40">
							{renderBody()}
						</div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{launcherExpanded && !open && (
					<motion.div className="flex flex-col items-end gap-3">
						<motion.div
							variants={launcherOptionVariants}
							initial="hidden"
							animate="visible"
							exit="exit"
							className="flex items-center gap-3"
						>
							<span className="rounded-full border border-border/40 bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-xl">
								Voice input
							</span>
							<button
								type="button"
								onClick={openVoiceInput}
								aria-label="Open voice input"
								className="flex size-11 items-center justify-center rounded-full bg-background text-primary shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105"
							>
								<MicIcon className="size-5" />
							</button>
						</motion.div>

						<motion.div
							variants={launcherOptionVariants}
							initial="hidden"
							animate="visible"
							exit="exit"
							transition={{ delay: 0.03 }}
							className="flex items-center gap-3"
						>
							<span className="rounded-full border border-border/40 bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-xl">
								Text input
							</span>
							<button
								type="button"
								onClick={openTextInput}
								aria-label="Open text input"
								className="flex size-11 items-center justify-center rounded-full bg-background text-primary shadow-lg ring-1 ring-black/5 transition-transform hover:scale-105"
							>
								<MessageSquareIcon className="size-5" />
							</button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<motion.button
				type="button"
				whileHover={{ scale: 1.05 }}
				whileTap={{ scale: 0.95 }}
				onClick={() => {
					if (open) {
						setOpen(false);
						return;
					}
					setLauncherExpanded((prev) => !prev);
				}}
				aria-label={
					open
						? "Close inbox assistant"
						: launcherExpanded
							? "Close input options"
							: "Open inbox assistant"
				}
				className={cn(
					"group relative flex size-14 items-center justify-center rounded-full shadow-lg shadow-primary/25 ring-1 ring-black/5 transition-all duration-300",
					open || launcherExpanded
						? "rotate-90 bg-destructive text-destructive-foreground"
						: "bg-primary text-primary-foreground hover:shadow-primary/40",
				)}
			>
				<span className="absolute inset-0 -z-10 rounded-full bg-inherit opacity-20 blur-xl transition-opacity duration-300 group-hover:opacity-40" />
				{open || launcherExpanded ? (
					<XIcon className="size-6" />
				) : (
					<MessageSquareIcon className="size-6" />
				)}
			</motion.button>

			<VoiceListeningOverlay
				open={voiceOpen}
				onClose={() => setVoiceOpen(false)}
				onTranscript={handleVoiceTranscript}
			/>
		</div>
	);
}
