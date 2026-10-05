import { advanceRuleBackfill } from "./procedures/advance-rule-backfill";
import { applyRulesToRecent } from "./procedures/apply-rules-to-recent";
import { archiveMessage } from "./procedures/archive-message";
import { cancelScheduledEmailProcedure } from "./procedures/cancel-scheduled-email";
import { cancelSnoozeProcedure } from "./procedures/cancel-snooze";
import {
	getChatThreadProcedure,
	listChatThreadsProcedure,
} from "./procedures/chat-threads";
import { compileRules } from "./procedures/compile-rules";
import { createRule } from "./procedures/create-rule";
import { deleteDraftProcedure } from "./procedures/delete-draft";
import { deleteMessage } from "./procedures/delete-message";
import { deleteRule } from "./procedures/delete-rule";
import { diagnoseMailbox } from "./procedures/diagnose-mailbox";
import { diagnoseMailboxExtended } from "./procedures/diagnose-mailbox-extended";
import { disableWatch } from "./procedures/disable-watch";
import { disconnectMailbox } from "./procedures/disconnect-mailbox";
import { enableWatch } from "./procedures/enable-watch";
import { enrichMailboxProcedure } from "./procedures/enrich-mailbox";
import { getCalendarEvents } from "./procedures/get-calendar-events";
import { getDraftProcedure } from "./procedures/get-draft";
import { getInboxMessage } from "./procedures/get-inbox-message";
import { getMailboxAiProcedure } from "./procedures/get-mailbox-ai";
import { getMailboxTasksProcedure } from "./procedures/get-mailbox-tasks";
import { getMessageHeaders } from "./procedures/get-message-headers";
import { getRuleBackfillStatus } from "./procedures/get-rule-backfill-status";
import { getStats } from "./procedures/get-stats";
import { getWatchStatus } from "./procedures/get-watch-status";
import { listDraftsProcedure } from "./procedures/list-drafts";
import { listExecutionLogs } from "./procedures/list-execution-logs";
import { listInboxMessages } from "./procedures/list-inbox-messages";
import { listRuleSuggestions } from "./procedures/list-rule-suggestions";
import { listRules } from "./procedures/list-rules";
import { listScheduledEmails } from "./procedures/list-scheduled-emails";
import { listSnoozedEmails } from "./procedures/list-snoozed-emails";
import { mailChat } from "./procedures/mail-chat";
import { markReadMessage } from "./procedures/mark-read-message";
import { markUnreadMessage } from "./procedures/mark-unread-message";
import { saveDraft } from "./procedures/save-draft";
import { scheduleEmail } from "./procedures/schedule-email";
import { sendDraftProcedure } from "./procedures/send-draft";
import { sendEmail } from "./procedures/send-email";
import { snoozeMessage } from "./procedures/snooze-message";
import { startRuleBackfill } from "./procedures/start-rule-backfill";
import { syncEmails } from "./procedures/sync-emails";
import { syncStatus } from "./procedures/sync-status";
import { testRule } from "./procedures/test-rule";
import { toggleRule } from "./procedures/toggle-rule";
import { trashMessage } from "./procedures/trash-message";
import { updateRule } from "./procedures/update-rule";

export const mailboxesRouter = {
	disconnect: disconnectMailbox,
	chat: mailChat,
	chatThreads: listChatThreadsProcedure,
	chatThread: getChatThreadProcedure,
	enrich: enrichMailboxProcedure,
	ai: getMailboxAiProcedure,
	tasks: getMailboxTasksProcedure,
	rules: {
		list: listRules,
		suggestions: listRuleSuggestions,
		create: createRule,
		update: updateRule,
		delete: deleteRule,
		toggle: toggleRule,
		compile: compileRules,
		test: testRule,
		applyRecent: applyRulesToRecent,
		backfill: {
			start: startRuleBackfill,
			advance: advanceRuleBackfill,
			status: getRuleBackfillStatus,
		},
	},
	watch: {
		enable: enableWatch,
		disable: disableWatch,
		status: getWatchStatus,
		diagnose: diagnoseMailbox,
		diagnoseExtended: diagnoseMailboxExtended,
	},
	executionLogs: {
		list: listExecutionLogs,
	},
	stats: getStats,
	calendar: {
		events: getCalendarEvents,
	},
	inbox: {
		list: listInboxMessages,
		sync: syncEmails,
		get: getInboxMessage,
		headers: getMessageHeaders,
		send: sendEmail,
		schedule: scheduleEmail,
		listScheduled: listScheduledEmails,
		cancelScheduled: cancelScheduledEmailProcedure,
		archive: archiveMessage,
		trash: trashMessage,
		delete: deleteMessage,
		markUnread: markUnreadMessage,
		markRead: markReadMessage,
		snooze: snoozeMessage,
		listSnoozed: listSnoozedEmails,
		cancelSnooze: cancelSnoozeProcedure,
		saveDraft: saveDraft,
		sendDraft: sendDraftProcedure,
		deleteDraft: deleteDraftProcedure,
		listDrafts: listDraftsProcedure,
		getDraft: getDraftProcedure,
		syncStatus: syncStatus,
	},
};
