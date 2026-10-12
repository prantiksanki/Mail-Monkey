import { composeVoiceEmail } from "./procedures/compose-voice-email";
import { composeVoiceEmailAnonymous } from "./procedures/compose-voice-email-anonymous";
import { createAiConversation } from "./procedures/create-conversation";
import { deleteAiConversation } from "./procedures/delete-conversation";
import { generateDrafts } from "./procedures/generate-drafts";
import { getAiConversation } from "./procedures/get-conversation";
import { inboxAssistant } from "./procedures/inbox-assistant";
import { listAiConversations } from "./procedures/list-conversations";
import { renameAiConversation } from "./procedures/rename-conversation";
import { rulesAssistant } from "./procedures/rules-assistant";
import { transcribeVoice } from "./procedures/transcribe-voice";
import { transcribeVoiceAnonymous } from "./procedures/transcribe-voice-anonymous";
import { transcribeVoiceDemo } from "./procedures/transcribe-voice-demo";

export const aiRouter = {
	rulesAssistant,
	generateDrafts,
	transcribeVoice,
	// Free-tier marketing homepage voice demo (requires login, no voice-minutes cap)
	transcribeVoiceDemo,
	// Signed-out marketing homepage voice demo (no session, IP rate-limited, always Sarvam)
	transcribeVoiceAnonymous,
	composeVoiceEmail,
	composeVoiceEmailAnonymous,
	// Inbox assistant
	inboxAssistant,
	listAiConversations,
	getAiConversation,
	createAiConversation,
	renameAiConversation,
	deleteAiConversation,
};
