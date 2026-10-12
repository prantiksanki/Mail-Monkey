import { advanceEmailClassification } from "./procedures/advance-email-classification";
import { advanceRuleBackfill } from "./procedures/advance-rule-backfill";
import { applyLabelMessage } from "./procedures/apply-label-message";
import { applyRulesToRecent } from "./procedures/apply-rules-to-recent";
import { archiveMessage } from "./procedures/archive-message";
import { cancelReminderProcedure } from "./procedures/cancel-reminder";
import { cancelScheduledEmailProcedure } from "./procedures/cancel-scheduled-email";
import { cancelSnoozeProcedure } from "./procedures/cancel-snooze";
import { compileRules } from "./procedures/compile-rules";
import { connectImapMailbox } from "./procedures/connect-imap-mailbox";
import { createCalendarEventProcedure } from "./procedures/create-calendar-event";
import { createMeeting } from "./procedures/create-meeting";
import { createReminderProcedure } from "./procedures/create-reminder";
import { createRule } from "./procedures/create-rule";
import { deleteDraftProcedure } from "./procedures/delete-draft";
import { deleteMessage } from "./procedures/delete-message";
import { deleteRule } from "./procedures/delete-rule";
import { diagnoseMailbox } from "./procedures/diagnose-mailbox";
import { diagnoseMailboxExtended } from "./procedures/diagnose-mailbox-extended";
import { disableWatch } from "./procedures/disable-watch";
import { disconnectMailbox } from "./procedures/disconnect-mailbox";
import { enableWatch } from "./procedures/enable-watch";
import { finishPendingImapMailbox } from "./procedures/finish-pending-imap-mailbox";
import { getCalendarEvents } from "./procedures/get-calendar-events";
import { getDashboardSummaryProcedure } from "./procedures/get-dashboard-summary";
import { getDraftProcedure } from "./procedures/get-draft";
import { getEmailClassificationStatus } from "./procedures/get-email-classification-status";
import { getInboxMessage } from "./procedures/get-inbox-message";
import { getMessageHeaders } from "./procedures/get-message-headers";
import { getRuleBackfillStatus } from "./procedures/get-rule-backfill-status";
import { getStats } from "./procedures/get-stats";
import { getWatchStatus } from "./procedures/get-watch-status";
import { labelCounts } from "./procedures/label-counts";
import { listDraftsProcedure } from "./procedures/list-drafts";
import { listExecutionLogs } from "./procedures/list-execution-logs";
import { listInboxMessages } from "./procedures/list-inbox-messages";
import { listRemindersProcedure } from "./procedures/list-reminders";
import { listRuleSuggestions } from "./procedures/list-rule-suggestions";
import { listRules } from "./procedures/list-rules";
import { listScheduledEmails } from "./procedures/list-scheduled-emails";
import { listSnoozedEmails } from "./procedures/list-snoozed-emails";
import { markReadMessage } from "./procedures/mark-read-message";
import { markUnreadMessage } from "./procedures/mark-unread-message";
import { saveDraft } from "./procedures/save-draft";
import { scheduleEmail } from "./procedures/schedule-email";
import { sendDraftProcedure } from "./procedures/send-draft";
import { sendEmail } from "./procedures/send-email";
import { sendWithUndo } from "./procedures/send-with-undo";
import { snoozeMessage } from "./procedures/snooze-message";
import { startEmailClassification } from "./procedures/start-email-classification";
import { startRuleBackfill } from "./procedures/start-rule-backfill";
import { syncEmails } from "./procedures/sync-emails";
import { syncStatus } from "./procedures/sync-status";
import { testRule } from "./procedures/test-rule";
import { toggleRule } from "./procedures/toggle-rule";
import { trashMessage } from "./procedures/trash-message";
import { updateRule } from "./procedures/update-rule";
import { verifyImapMailbox } from "./procedures/verify-imap-mailbox";

export const mailboxesRouter = {
	disconnect: disconnectMailbox,
	connectImap: connectImapMailbox,
	verifyImap: verifyImapMailbox,
	finishPendingImap: finishPendingImapMailbox,
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
	classification: {
		start: startEmailClassification,
		advance: advanceEmailClassification,
		status: getEmailClassificationStatus,
	},
	executionLogs: {
		list: listExecutionLogs,
	},
	stats: getStats,
	dashboard: {
		summary: getDashboardSummaryProcedure,
	},
	calendar: {
		events: getCalendarEvents,
		createMeeting: createMeeting,
		createEvent: createCalendarEventProcedure,
	},
	reminders: {
		create: createReminderProcedure,
		list: listRemindersProcedure,
		cancel: cancelReminderProcedure,
	},
	inbox: {
		list: listInboxMessages,
		sync: syncEmails,
		get: getInboxMessage,
		headers: getMessageHeaders,
		send: sendEmail,
		sendWithUndo: sendWithUndo,
		schedule: scheduleEmail,
		listScheduled: listScheduledEmails,
		cancelScheduled: cancelScheduledEmailProcedure,
		archive: archiveMessage,
		trash: trashMessage,
		delete: deleteMessage,
		markUnread: markUnreadMessage,
		markRead: markReadMessage,
		applyLabel: applyLabelMessage,
		snooze: snoozeMessage,
		listSnoozed: listSnoozedEmails,
		cancelSnooze: cancelSnoozeProcedure,
		saveDraft: saveDraft,
		sendDraft: sendDraftProcedure,
		deleteDraft: deleteDraftProcedure,
		listDrafts: listDraftsProcedure,
		getDraft: getDraftProcedure,
		syncStatus: syncStatus,
		labelCounts: labelCounts,
	},
};
