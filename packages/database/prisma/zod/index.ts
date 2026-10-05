/**
 * Prisma Zod Generator - Single File (inlined)
 * Auto-generated. Do not edit.
 */

import * as z from 'zod';
// File: TransactionIsolationLevel.schema.ts

export const TransactionIsolationLevelSchema = z.enum(['ReadUncommitted', 'ReadCommitted', 'RepeatableRead', 'Serializable'])

export type TransactionIsolationLevel = z.infer<typeof TransactionIsolationLevelSchema>;

// File: UserScalarFieldEnum.schema.ts

export const UserScalarFieldEnumSchema = z.enum(['id', 'name', 'email', 'emailVerified', 'image', 'createdAt', 'updatedAt', 'username', 'role', 'banned', 'banReason', 'banExpires', 'onboardingComplete', 'paymentsCustomerId', 'locale', 'displayUsername', 'twoFactorEnabled'])

export type UserScalarFieldEnum = z.infer<typeof UserScalarFieldEnumSchema>;

// File: SessionScalarFieldEnum.schema.ts

export const SessionScalarFieldEnumSchema = z.enum(['id', 'expiresAt', 'ipAddress', 'userAgent', 'userId', 'impersonatedBy', 'activeOrganizationId', 'token', 'createdAt', 'updatedAt'])

export type SessionScalarFieldEnum = z.infer<typeof SessionScalarFieldEnumSchema>;

// File: AccountScalarFieldEnum.schema.ts

export const AccountScalarFieldEnumSchema = z.enum(['id', 'accountId', 'providerId', 'userId', 'accessToken', 'refreshToken', 'idToken', 'expiresAt', 'password', 'accessTokenExpiresAt', 'refreshTokenExpiresAt', 'scope', 'createdAt', 'updatedAt'])

export type AccountScalarFieldEnum = z.infer<typeof AccountScalarFieldEnumSchema>;

// File: MailboxScalarFieldEnum.schema.ts

export const MailboxScalarFieldEnumSchema = z.enum(['id', 'userId', 'accountId', 'name', 'email', 'picture', 'provider', 'watchEnabled', 'watchExpiry', 'lastHistoryId', 'subscriptionId', 'subscriptionClientState', 'emailSyncComplete', 'emailSyncCursor', 'createdAt', 'updatedAt'])

export type MailboxScalarFieldEnum = z.infer<typeof MailboxScalarFieldEnumSchema>;

// File: MailboxUsageTrackingScalarFieldEnum.schema.ts

export const MailboxUsageTrackingScalarFieldEnumSchema = z.enum(['id', 'mailboxId', 'periodStart', 'periodEnd', 'emailsProcessed', 'createdAt', 'updatedAt'])

export type MailboxUsageTrackingScalarFieldEnum = z.infer<typeof MailboxUsageTrackingScalarFieldEnumSchema>;

// File: ScheduledEmailScalarFieldEnum.schema.ts

export const ScheduledEmailScalarFieldEnumSchema = z.enum(['id', 'mailboxId', 'to', 'cc', 'bcc', 'subject', 'body', 'scheduledAt', 'status', 'sentAt', 'messageId', 'error', 'attempts', 'createdAt', 'updatedAt'])

export type ScheduledEmailScalarFieldEnum = z.infer<typeof ScheduledEmailScalarFieldEnumSchema>;

// File: SnoozedEmailScalarFieldEnum.schema.ts

export const SnoozedEmailScalarFieldEnumSchema = z.enum(['id', 'mailboxId', 'messageId', 'threadId', 'from', 'subject', 'snippet', 'internalDate', 'isUnread', 'originalLabelIds', 'snoozeUntil', 'status', 'returnedAt', 'error', 'attempts', 'createdAt', 'updatedAt'])

export type SnoozedEmailScalarFieldEnum = z.infer<typeof SnoozedEmailScalarFieldEnumSchema>;

// File: RuleScalarFieldEnum.schema.ts

export const RuleScalarFieldEnumSchema = z.enum(['id', 'mailboxId', 'name', 'enabled', 'condition', 'actions', 'createdAt', 'updatedAt'])

export type RuleScalarFieldEnum = z.infer<typeof RuleScalarFieldEnumSchema>;

// File: RuleBackfillRunScalarFieldEnum.schema.ts

export const RuleBackfillRunScalarFieldEnumSchema = z.enum(['id', 'mailboxId', 'ruleId', 'status', 'windowMonths', 'windowStart', 'windowEnd', 'query', 'nextPageToken', 'estimatedTotal', 'processedCount', 'matchedCount', 'appliedCount', 'skippedCount', 'errorCount', 'lastError', 'completedAt', 'createdAt', 'updatedAt'])

export type RuleBackfillRunScalarFieldEnum = z.infer<typeof RuleBackfillRunScalarFieldEnumSchema>;

// File: RuleExecutionLogScalarFieldEnum.schema.ts

export const RuleExecutionLogScalarFieldEnumSchema = z.enum(['id', 'ruleId', 'mailboxId', 'messageId', 'threadId', 'subject', 'from', 'status', 'actionsRun', 'error', 'createdAt'])

export type RuleExecutionLogScalarFieldEnum = z.infer<typeof RuleExecutionLogScalarFieldEnumSchema>;

// File: VerificationScalarFieldEnum.schema.ts

export const VerificationScalarFieldEnumSchema = z.enum(['id', 'identifier', 'value', 'expiresAt', 'createdAt', 'updatedAt'])

export type VerificationScalarFieldEnum = z.infer<typeof VerificationScalarFieldEnumSchema>;

// File: PasskeyScalarFieldEnum.schema.ts

export const PasskeyScalarFieldEnumSchema = z.enum(['id', 'name', 'publicKey', 'userId', 'credentialID', 'counter', 'deviceType', 'backedUp', 'transports', 'aaguid', 'createdAt'])

export type PasskeyScalarFieldEnum = z.infer<typeof PasskeyScalarFieldEnumSchema>;

// File: TwoFactorScalarFieldEnum.schema.ts

export const TwoFactorScalarFieldEnumSchema = z.enum(['id', 'secret', 'backupCodes', 'userId'])

export type TwoFactorScalarFieldEnum = z.infer<typeof TwoFactorScalarFieldEnumSchema>;

// File: OrganizationScalarFieldEnum.schema.ts

export const OrganizationScalarFieldEnumSchema = z.enum(['id', 'name', 'slug', 'logo', 'createdAt', 'metadata', 'paymentsCustomerId'])

export type OrganizationScalarFieldEnum = z.infer<typeof OrganizationScalarFieldEnumSchema>;

// File: MemberScalarFieldEnum.schema.ts

export const MemberScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'role', 'createdAt'])

export type MemberScalarFieldEnum = z.infer<typeof MemberScalarFieldEnumSchema>;

// File: InvitationScalarFieldEnum.schema.ts

export const InvitationScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'email', 'role', 'status', 'expiresAt', 'inviterId', 'createdAt'])

export type InvitationScalarFieldEnum = z.infer<typeof InvitationScalarFieldEnumSchema>;

// File: PurchaseScalarFieldEnum.schema.ts

export const PurchaseScalarFieldEnumSchema = z.enum(['id', 'organizationId', 'userId', 'type', 'customerId', 'subscriptionId', 'productId', 'status', 'createdAt', 'updatedAt'])

export type PurchaseScalarFieldEnum = z.infer<typeof PurchaseScalarFieldEnumSchema>;

// File: EmailScalarFieldEnum.schema.ts

export const EmailScalarFieldEnumSchema = z.enum(['id', 'mailboxId', 'threadId', 'from', 'fromEmail', 'to', 'subject', 'snippet', 'bodyText', 'bodyHtml', 'labelIds', 'isUnread', 'internalDate', 'syncedAt'])

export type EmailScalarFieldEnum = z.infer<typeof EmailScalarFieldEnumSchema>;

// File: TelegramConnectionScalarFieldEnum.schema.ts

export const TelegramConnectionScalarFieldEnumSchema = z.enum(['id', 'userId', 'telegramUserId', 'chatId', 'username', 'firstName', 'lastName', 'languageCode', 'enabled', 'timezone', 'dailyDigestTime', 'lastBriefingSentAt', 'createdAt', 'updatedAt'])

export type TelegramConnectionScalarFieldEnum = z.infer<typeof TelegramConnectionScalarFieldEnumSchema>;

// File: TelegramLinkTokenScalarFieldEnum.schema.ts

export const TelegramLinkTokenScalarFieldEnumSchema = z.enum(['id', 'token', 'userId', 'expiresAt', 'usedAt', 'createdAt'])

export type TelegramLinkTokenScalarFieldEnum = z.infer<typeof TelegramLinkTokenScalarFieldEnumSchema>;

// File: TelegramActionScalarFieldEnum.schema.ts

export const TelegramActionScalarFieldEnumSchema = z.enum(['id', 'userId', 'mailboxId', 'messageId', 'action', 'usedAt', 'expiresAt', 'createdAt'])

export type TelegramActionScalarFieldEnum = z.infer<typeof TelegramActionScalarFieldEnumSchema>;

// File: TelegramBriefingScalarFieldEnum.schema.ts

export const TelegramBriefingScalarFieldEnumSchema = z.enum(['id', 'userId', 'mailboxId', 'briefingDate', 'categoryCounts', 'messageIds', 'sentAt', 'createdAt'])

export type TelegramBriefingScalarFieldEnum = z.infer<typeof TelegramBriefingScalarFieldEnumSchema>;

// File: SortOrder.schema.ts

export const SortOrderSchema = z.enum(['asc', 'desc'])

export type SortOrder = z.infer<typeof SortOrderSchema>;

// File: JsonNullValueInput.schema.ts

export const JsonNullValueInputSchema = z.enum(['JsonNull'])

export type JsonNullValueInput = z.infer<typeof JsonNullValueInputSchema>;

// File: QueryMode.schema.ts

export const QueryModeSchema = z.enum(['default', 'insensitive'])

export type QueryMode = z.infer<typeof QueryModeSchema>;

// File: NullsOrder.schema.ts

export const NullsOrderSchema = z.enum(['first', 'last'])

export type NullsOrder = z.infer<typeof NullsOrderSchema>;

// File: JsonNullValueFilter.schema.ts

export const JsonNullValueFilterSchema = z.enum(['DbNull', 'JsonNull', 'AnyNull'])

export type JsonNullValueFilter = z.infer<typeof JsonNullValueFilterSchema>;

// File: MailboxProvider.schema.ts

export const MailboxProviderSchema = z.enum(['GOOGLE', 'OUTLOOK'])

export type MailboxProvider = z.infer<typeof MailboxProviderSchema>;

// File: ScheduledEmailStatus.schema.ts

export const ScheduledEmailStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELED'])

export type ScheduledEmailStatus = z.infer<typeof ScheduledEmailStatusSchema>;

// File: SnoozeStatus.schema.ts

export const SnoozeStatusSchema = z.enum(['SNOOZED', 'RETURNED', 'CANCELED'])

export type SnoozeStatus = z.infer<typeof SnoozeStatusSchema>;

// File: PurchaseType.schema.ts

export const PurchaseTypeSchema = z.enum(['SUBSCRIPTION', 'ONE_TIME'])

export type PurchaseType = z.infer<typeof PurchaseTypeSchema>;

// File: TelegramActionType.schema.ts

export const TelegramActionTypeSchema = z.enum(['ARCHIVE', 'MARK_READ', 'TRASH'])

export type TelegramActionType = z.infer<typeof TelegramActionTypeSchema>;

// File: User.schema.ts

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
  username: z.string().nullish(),
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  banReason: z.string().nullish(),
  banExpires: z.date().nullish(),
  onboardingComplete: z.boolean(),
  paymentsCustomerId: z.string().nullish(),
  locale: z.string().nullish(),
  displayUsername: z.string().nullish(),
  twoFactorEnabled: z.boolean().nullish(),
});

export type UserType = z.infer<typeof UserSchema>;


// File: Session.schema.ts

export const SessionSchema = z.object({
  id: z.string(),
  expiresAt: z.date(),
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  userId: z.string(),
  impersonatedBy: z.string().nullish(),
  activeOrganizationId: z.string().nullish(),
  token: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SessionType = z.infer<typeof SessionSchema>;


// File: Account.schema.ts

export const AccountSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  providerId: z.string(),
  userId: z.string(),
  accessToken: z.string().nullish(),
  refreshToken: z.string().nullish(),
  idToken: z.string().nullish(),
  expiresAt: z.date().nullish(),
  password: z.string().nullish(),
  accessTokenExpiresAt: z.date().nullish(),
  refreshTokenExpiresAt: z.date().nullish(),
  scope: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AccountType = z.infer<typeof AccountSchema>;


// File: Mailbox.schema.ts

export const MailboxSchema = z.object({
  id: z.string(),
  userId: z.string(),
  accountId: z.string(),
  name: z.string().nullish(),
  email: z.string(),
  picture: z.string().nullish(),
  provider: MailboxProviderSchema.default("GOOGLE"),
  watchEnabled: z.boolean(),
  watchExpiry: z.date().nullish(),
  lastHistoryId: z.string().nullish(),
  subscriptionId: z.string().nullish(),
  subscriptionClientState: z.string().nullish(),
  emailSyncComplete: z.boolean(),
  emailSyncCursor: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MailboxType = z.infer<typeof MailboxSchema>;


// File: MailboxUsageTracking.schema.ts

export const MailboxUsageTrackingSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  periodStart: z.date(),
  periodEnd: z.date(),
  emailsProcessed: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MailboxUsageTrackingType = z.infer<typeof MailboxUsageTrackingSchema>;


// File: ScheduledEmail.schema.ts

export const ScheduledEmailSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  to: z.string(),
  cc: z.string().nullish(),
  bcc: z.string().nullish(),
  subject: z.string(),
  body: z.string(),
  scheduledAt: z.date(),
  status: ScheduledEmailStatusSchema.default("PENDING"),
  sentAt: z.date().nullish(),
  messageId: z.string().nullish(),
  error: z.string().nullish(),
  attempts: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type ScheduledEmailType = z.infer<typeof ScheduledEmailSchema>;


// File: SnoozedEmail.schema.ts

export const SnoozedEmailSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  messageId: z.string(),
  threadId: z.string().nullish(),
  from: z.string(),
  subject: z.string(),
  snippet: z.string(),
  internalDate: z.date(),
  isUnread: z.boolean().default(true),
  originalLabelIds: z.array(z.string()),
  snoozeUntil: z.date(),
  status: SnoozeStatusSchema.default("SNOOZED"),
  returnedAt: z.date().nullish(),
  error: z.string().nullish(),
  attempts: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type SnoozedEmailType = z.infer<typeof SnoozedEmailSchema>;


// File: Rule.schema.ts

export const RuleSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  condition: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  actions: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RuleType = z.infer<typeof RuleSchema>;


// File: RuleBackfillRun.schema.ts

export const RuleBackfillRunSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  ruleId: z.string(),
  status: z.string(),
  windowMonths: z.number().int(),
  windowStart: z.date(),
  windowEnd: z.date(),
  query: z.string().nullish(),
  nextPageToken: z.string().nullish(),
  estimatedTotal: z.number().int().nullish(),
  processedCount: z.number().int(),
  matchedCount: z.number().int(),
  appliedCount: z.number().int(),
  skippedCount: z.number().int(),
  errorCount: z.number().int(),
  lastError: z.string().nullish(),
  completedAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RuleBackfillRunType = z.infer<typeof RuleBackfillRunSchema>;


// File: RuleExecutionLog.schema.ts

export const RuleExecutionLogSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  mailboxId: z.string(),
  messageId: z.string(),
  threadId: z.string().nullish(),
  subject: z.string().nullish(),
  from: z.string().nullish(),
  status: z.string(),
  actionsRun: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10").default("[]"),
  error: z.string().nullish(),
  createdAt: z.date(),
});

export type RuleExecutionLogType = z.infer<typeof RuleExecutionLogSchema>;


// File: Verification.schema.ts

export const VerificationSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  value: z.string(),
  expiresAt: z.date(),
  createdAt: z.date().nullish(),
  updatedAt: z.date().nullish(),
});

export type VerificationType = z.infer<typeof VerificationSchema>;


// File: Passkey.schema.ts

export const PasskeySchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
  publicKey: z.string(),
  userId: z.string(),
  credentialID: z.string(),
  counter: z.number().int(),
  deviceType: z.string(),
  backedUp: z.boolean(),
  transports: z.string().nullish(),
  aaguid: z.string().nullish(),
  createdAt: z.date().nullish(),
});

export type PasskeyType = z.infer<typeof PasskeySchema>;


// File: TwoFactor.schema.ts

export const TwoFactorSchema = z.object({
  id: z.string(),
  secret: z.string(),
  backupCodes: z.string(),
  userId: z.string(),
});

export type TwoFactorType = z.infer<typeof TwoFactorSchema>;


// File: Organization.schema.ts

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string().nullish(),
  logo: z.string().nullish(),
  createdAt: z.date(),
  metadata: z.string().nullish(),
  paymentsCustomerId: z.string().nullish(),
});

export type OrganizationType = z.infer<typeof OrganizationSchema>;


// File: Member.schema.ts

export const MemberSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  role: z.string(),
  createdAt: z.date(),
});

export type MemberType = z.infer<typeof MemberSchema>;


// File: Invitation.schema.ts

export const InvitationSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  email: z.string(),
  role: z.string().nullish(),
  status: z.string(),
  expiresAt: z.date(),
  inviterId: z.string(),
  createdAt: z.date(),
});

export type InvitationType = z.infer<typeof InvitationSchema>;


// File: Purchase.schema.ts

export const PurchaseSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullish(),
  userId: z.string().nullish(),
  type: PurchaseTypeSchema,
  customerId: z.string(),
  subscriptionId: z.string().nullish(),
  productId: z.string(),
  status: z.string().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type PurchaseModel = z.infer<typeof PurchaseSchema>;

// File: Email.schema.ts

export const EmailSchema = z.object({
  id: z.string(),
  mailboxId: z.string(),
  threadId: z.string(),
  from: z.string(),
  fromEmail: z.string(),
  to: z.string(),
  subject: z.string(),
  snippet: z.string(),
  bodyText: z.string(),
  bodyHtml: z.string(),
  labelIds: z.array(z.string()),
  isUnread: z.boolean().default(true),
  internalDate: z.date(),
  syncedAt: z.date(),
});

export type EmailType = z.infer<typeof EmailSchema>;


// File: TelegramConnection.schema.ts

export const TelegramConnectionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  telegramUserId: z.string(),
  chatId: z.string(),
  username: z.string().nullish(),
  firstName: z.string().nullish(),
  lastName: z.string().nullish(),
  languageCode: z.string().nullish(),
  enabled: z.boolean().default(true),
  timezone: z.string().default("Asia/Calcutta"),
  dailyDigestTime: z.string().default("09:00"),
  lastBriefingSentAt: z.date().nullish(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TelegramConnectionType = z.infer<typeof TelegramConnectionSchema>;


// File: TelegramLinkToken.schema.ts

export const TelegramLinkTokenSchema = z.object({
  id: z.string(),
  token: z.string(),
  userId: z.string(),
  expiresAt: z.date(),
  usedAt: z.date().nullish(),
  createdAt: z.date(),
});

export type TelegramLinkTokenType = z.infer<typeof TelegramLinkTokenSchema>;


// File: TelegramAction.schema.ts

export const TelegramActionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mailboxId: z.string(),
  messageId: z.string(),
  action: TelegramActionTypeSchema,
  usedAt: z.date().nullish(),
  expiresAt: z.date(),
  createdAt: z.date(),
});

export type TelegramActionModel = z.infer<typeof TelegramActionSchema>;

// File: TelegramBriefing.schema.ts

export const TelegramBriefingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  mailboxId: z.string(),
  briefingDate: z.date(),
  categoryCounts: z.unknown().refine((val) => { const getDepth = (obj: unknown, depth: number = 0): number => { if (depth > 10) return depth; if (obj === null || typeof obj !== 'object') return depth; const values = Object.values(obj as Record<string, unknown>); if (values.length === 0) return depth; return Math.max(...values.map(v => getDepth(v, depth + 1))); }; return getDepth(val) <= 10; }, "JSON nesting depth exceeds maximum of 10"),
  messageIds: z.array(z.string()),
  sentAt: z.date(),
  createdAt: z.date(),
});

export type TelegramBriefingType = z.infer<typeof TelegramBriefingSchema>;

