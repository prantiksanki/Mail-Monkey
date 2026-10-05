import { z } from "zod";

export const RuleActionTypeEnum = z.enum([
	"LABEL",
	"ARCHIVE",
	"MARK_READ",
	"DRAFT_EMAIL",
	"REPLY",
	"FORWARD",
	"MARK_SPAM",
]);

export const RuleActionFieldsSchema = z.object({
	label: z.string().nullish(),
	to: z.string().nullish(),
	cc: z.string().nullish(),
	bcc: z.string().nullish(),
	subject: z.string().nullish(),
	content: z.string().nullish(),
});

export const RuleActionSchema = z.object({
	type: RuleActionTypeEnum,
	fields: RuleActionFieldsSchema.optional(),
});

export const RuleStaticConditionSchema = z.object({
	from: z.string().nullish(),
	to: z.string().nullish(),
	subject: z.string().nullish(),
});

export const RuleConditionSchema = z.object({
	conditionalOperator: z.enum(["AND", "OR"]).nullable().optional(),
	aiInstructions: z.string().nullable().optional(),
	static: RuleStaticConditionSchema.nullish().optional(),
});

export const CreateRuleSchema = z.object({
	name: z.string().min(1),
	condition: RuleConditionSchema,
	actions: z.array(RuleActionSchema).min(1),
	enabled: z.boolean().optional(),
});

export const UpdateRuleSchema = CreateRuleSchema.partial();

export const RuleBackfillStatusSchema = z.enum([
	"pending",
	"running",
	"completed",
	"failed",
]);

export const RuleBackfillWindowMonthsSchema = z.enum(["1", "3", "6", "12"]);

export type RuleActionType = z.infer<typeof RuleActionTypeEnum>;
export type RuleActionFields = z.infer<typeof RuleActionFieldsSchema>;
export type RuleAction = z.infer<typeof RuleActionSchema>;
export type RuleStaticCondition = z.infer<typeof RuleStaticConditionSchema>;
export type RuleCondition = z.infer<typeof RuleConditionSchema>;
export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;
export type UpdateRuleInput = z.infer<typeof UpdateRuleSchema>;
export type RuleBackfillStatus = z.infer<typeof RuleBackfillStatusSchema>;
export type RuleBackfillWindowMonths = z.infer<
	typeof RuleBackfillWindowMonthsSchema
>;
