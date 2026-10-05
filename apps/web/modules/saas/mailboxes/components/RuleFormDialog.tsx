"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@repo/ui/components/form";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
	getConflictMessage,
	useCreateRuleMutation,
	useUpdateRuleMutation,
} from "../lib/rules-api";

const ruleActionTypes = [
	"LABEL",
	"ARCHIVE",
	"MARK_READ",
	"DRAFT_EMAIL",
	"REPLY",
	"FORWARD",
	"MARK_SPAM",
] as const;

const ruleFormSchema = z.object({
	name: z.string().min(1, "Name is required"),
	conditionalOperator: z.enum(["AND", "OR", "NONE"]).optional(),
	aiInstructions: z.string().optional(),
	staticFrom: z.string().optional(),
	staticTo: z.string().optional(),
	staticSubject: z.string().optional(),
	actions: z
		.array(
			z.object({
				type: z.enum(ruleActionTypes),
				label: z.string().optional(),
				to: z.string().optional(),
				cc: z.string().optional(),
				bcc: z.string().optional(),
				subject: z.string().optional(),
				content: z.string().optional(),
			}),
		)
		.min(1, "At least one action is required"),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

type EditingRule = {
	id?: string;
	name: string;
	enabled?: boolean;
	condition: {
		conditionalOperator?: string | null;
		aiInstructions?: string | null;
		static?: {
			from?: string | null;
			to?: string | null;
			subject?: string | null;
		} | null;
	};
	actions: Array<{
		type: string;
		fields?: Record<string, unknown>;
	}>;
};

export function RuleFormDialog({
	open,
	onOpenChange,
	mailboxId,
	editingRule,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mailboxId: string | null;
	editingRule?: EditingRule | null;
}) {
	const t = useTranslations();
	const createMutation = useCreateRuleMutation();
	const updateMutation = useUpdateRuleMutation();

	const form = useForm<RuleFormValues>({
		resolver: zodResolver(ruleFormSchema),
		defaultValues: {
			name: "",
			conditionalOperator: "NONE",
			aiInstructions: "",
			staticFrom: "",
			staticTo: "",
			staticSubject: "",
			actions: [{ type: "LABEL" }],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "actions",
	});

	// Reset form when dialog opens/closes or editing rule changes
	useEffect(() => {
		if (open && editingRule) {
			form.reset({
				name: editingRule.name,
				conditionalOperator:
					(editingRule.condition.conditionalOperator as
						| "AND"
						| "OR"
						| "NONE") || "NONE",
				aiInstructions: editingRule.condition.aiInstructions || "",
				staticFrom: editingRule.condition.static?.from || "",
				staticTo: editingRule.condition.static?.to || "",
				staticSubject: editingRule.condition.static?.subject || "",
				actions: editingRule.actions.map((action) => ({
					type: action.type as (typeof ruleActionTypes)[number],
					label: (action.fields?.label as string) || "",
					to: (action.fields?.to as string) || "",
					cc: (action.fields?.cc as string) || "",
					bcc: (action.fields?.bcc as string) || "",
					subject: (action.fields?.subject as string) || "",
					content: (action.fields?.content as string) || "",
				})),
			});
		} else if (open && !editingRule) {
			form.reset({
				name: "",
				conditionalOperator: "NONE",
				aiInstructions: "",
				staticFrom: "",
				staticTo: "",
				staticSubject: "",
				actions: [{ type: "LABEL" }],
			});
		}
	}, [open, editingRule, form]);

	const onSubmit = form.handleSubmit(async (data) => {
		if (!mailboxId) {
			return;
		}

		// Build condition object
		const condition: {
			conditionalOperator?: string | null;
			aiInstructions?: string | null;
			static?: {
				from?: string | null;
				to?: string | null;
				subject?: string | null;
			} | null;
		} = {};

		if (data.conditionalOperator && data.conditionalOperator !== "NONE") {
			condition.conditionalOperator = data.conditionalOperator;
		}
		if (data.aiInstructions) {
			condition.aiInstructions = data.aiInstructions;
		}
		if (data.staticFrom || data.staticTo || data.staticSubject) {
			condition.static = {
				from: data.staticFrom || null,
				to: data.staticTo || null,
				subject: data.staticSubject || null,
			};
		}

		// Build actions array
		const actions = data.actions.map((action) => {
			const fields: Record<string, string> = {};
			if (action.label) {
				fields.label = action.label;
			}
			if (action.to) {
				fields.to = action.to;
			}
			if (action.cc) {
				fields.cc = action.cc;
			}
			if (action.bcc) {
				fields.bcc = action.bcc;
			}
			if (action.subject) {
				fields.subject = action.subject;
			}
			if (action.content) {
				fields.content = action.content;
			}

			return {
				type: action.type,
				...(Object.keys(fields).length > 0 ? { fields } : {}),
			};
		});

		try {
			if (editingRule?.id) {
				await updateMutation.mutateAsync({
					mailboxId,
					id: editingRule.id,
					data: {
						name: data.name,
						condition,
						actions,
					},
				});
				toast.success(t("rules.ruleForm.notifications.updated"));
			} else {
				await createMutation.mutateAsync({
					mailboxId,
					data: {
						name: data.name,
						condition,
						actions,
						enabled: true,
					},
				});
				toast.success(t("rules.ruleForm.notifications.created"));
			}

			onOpenChange(false);
		} catch (error) {
			// Surface the server message for known conflicts (e.g. a rule with
			// the same name already exists), otherwise fall back to generic.
			toast.error(
				getConflictMessage(error) ??
					t("rules.ruleForm.notifications.error"),
			);
		}
	});

	const getActionFields = (actionType: string) => {
		switch (actionType) {
			case "LABEL":
				return ["label"];
			case "FORWARD":
				return ["to", "cc", "bcc", "subject", "content"];
			case "REPLY":
			case "DRAFT_EMAIL":
				return ["subject", "content"];
			default:
				return [];
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{editingRule
							? t("rules.ruleForm.editTitle")
							: t("rules.ruleForm.createTitle")}
					</DialogTitle>
				</DialogHeader>

				<Form {...form}>
					<form onSubmit={onSubmit} className="space-y-6">
						{/* Name */}
						<FormField
							control={form.control}
							name="name"
							render={({ field }) => (
								<FormItem>
									<FormLabel>
										{t("rules.ruleForm.name")}
									</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder={t(
												"rules.ruleForm.namePlaceholder",
											)}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						{/* Conditions */}
						<div className="space-y-4">
							<h3 className="font-semibold text-foreground">
								{t("rules.ruleForm.conditions")}
							</h3>

							<FormField
								control={form.control}
								name="conditionalOperator"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t(
												"rules.ruleForm.conditionalOperator",
											)}
										</FormLabel>
										<Select
											onValueChange={field.onChange}
											value={field.value}
										>
											<FormControl>
												<SelectTrigger>
													<SelectValue />
												</SelectTrigger>
											</FormControl>
											<SelectContent>
												<SelectItem value="NONE">
													{t(
														"rules.ruleForm.conditionalOperatorOptions.NONE",
													)}
												</SelectItem>
												<SelectItem value="AND">
													{t(
														"rules.ruleForm.conditionalOperatorOptions.AND",
													)}
												</SelectItem>
												<SelectItem value="OR">
													{t(
														"rules.ruleForm.conditionalOperatorOptions.OR",
													)}
												</SelectItem>
											</SelectContent>
										</Select>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="aiInstructions"
								render={({ field }) => (
									<FormItem>
										<FormLabel>
											{t("rules.ruleForm.aiInstructions")}
										</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												placeholder={t(
													"rules.ruleForm.aiInstructionsPlaceholder",
												)}
												className="min-h-[80px]"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="space-y-3">
								<h4 className="text-sm font-medium">
									{t("rules.ruleForm.staticConditions")}
								</h4>

								<FormField
									control={form.control}
									name="staticFrom"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("rules.ruleForm.from")}
											</FormLabel>
											<FormControl>
												<Input
													{...field}
													placeholder={t(
														"rules.ruleForm.fromPlaceholder",
													)}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="staticTo"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("rules.ruleForm.to")}
											</FormLabel>
											<FormControl>
												<Input
													{...field}
													placeholder={t(
														"rules.ruleForm.toPlaceholder",
													)}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="staticSubject"
									render={({ field }) => (
										<FormItem>
											<FormLabel>
												{t("rules.ruleForm.subject")}
											</FormLabel>
											<FormControl>
												<Input
													{...field}
													placeholder={t(
														"rules.ruleForm.subjectPlaceholder",
													)}
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
						</div>

						{/* Actions */}
						<div className="space-y-4">
							<div className="flex items-center justify-between">
								<h3 className="font-semibold text-foreground">
									{t("rules.ruleForm.actions")}
								</h3>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => append({ type: "LABEL" })}
								>
									<PlusIcon className="h-4 w-4" />
									{t("rules.ruleForm.addAction")}
								</Button>
							</div>

							{fields.map((field, index) => {
								const actionType = form.watch(
									`actions.${index}.type`,
								);
								const requiredFields =
									getActionFields(actionType);

								return (
									<div
										key={field.id}
										className="space-y-3 rounded-lg border p-4"
									>
										<div className="flex items-center justify-between">
											<FormField
												control={form.control}
												name={`actions.${index}.type`}
												render={({ field }) => (
													<FormItem className="flex-1">
														<FormLabel>
															{t(
																"rules.ruleForm.actionType",
															)}
														</FormLabel>
														<Select
															onValueChange={
																field.onChange
															}
															value={field.value}
														>
															<FormControl>
																<SelectTrigger>
																	<SelectValue />
																</SelectTrigger>
															</FormControl>
															<SelectContent>
																{ruleActionTypes.map(
																	(type) => (
																		<SelectItem
																			key={
																				type
																			}
																			value={
																				type
																			}
																		>
																			{t(
																				`rules.ruleForm.actionTypes.${type}`,
																			)}
																		</SelectItem>
																	),
																)}
															</SelectContent>
														</Select>
														<FormMessage />
													</FormItem>
												)}
											/>

											{fields.length > 1 && (
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onClick={() =>
														remove(index)
													}
													className="ml-2 mt-8"
												>
													<XIcon className="h-4 w-4" />
												</Button>
											)}
										</div>

										{/* Dynamic action fields */}
										{requiredFields.includes("label") && (
											<FormField
												control={form.control}
												name={`actions.${index}.label`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t(
																"rules.ruleForm.actionFields.label",
															)}
														</FormLabel>
														<FormControl>
															<Input {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										)}

										{requiredFields.includes("to") && (
											<>
												<FormField
													control={form.control}
													name={`actions.${index}.to`}
													render={({ field }) => (
														<FormItem>
															<FormLabel>
																{t(
																	"rules.ruleForm.actionFields.to",
																)}
															</FormLabel>
															<FormControl>
																<Input
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
												<FormField
													control={form.control}
													name={`actions.${index}.cc`}
													render={({ field }) => (
														<FormItem>
															<FormLabel>
																{t(
																	"rules.ruleForm.actionFields.cc",
																)}
															</FormLabel>
															<FormControl>
																<Input
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
												<FormField
													control={form.control}
													name={`actions.${index}.bcc`}
													render={({ field }) => (
														<FormItem>
															<FormLabel>
																{t(
																	"rules.ruleForm.actionFields.bcc",
																)}
															</FormLabel>
															<FormControl>
																<Input
																	{...field}
																/>
															</FormControl>
															<FormMessage />
														</FormItem>
													)}
												/>
											</>
										)}

										{requiredFields.includes("subject") && (
											<FormField
												control={form.control}
												name={`actions.${index}.subject`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t(
																"rules.ruleForm.actionFields.subject",
															)}
														</FormLabel>
														<FormControl>
															<Input {...field} />
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										)}

										{requiredFields.includes("content") && (
											<FormField
												control={form.control}
												name={`actions.${index}.content`}
												render={({ field }) => (
													<FormItem>
														<FormLabel>
															{t(
																"rules.ruleForm.actionFields.content",
															)}
														</FormLabel>
														<FormControl>
															<Textarea
																{...field}
																className="min-h-[80px]"
															/>
														</FormControl>
														<FormMessage />
													</FormItem>
												)}
											/>
										)}
									</div>
								);
							})}
						</div>

						{/* Submit */}
						<div className="flex justify-end gap-3 pt-2">
							<Button
								type="button"
								variant="secondary"
								onClick={() => onOpenChange(false)}
							>
								{t("rules.ruleForm.cancel")}
							</Button>
							<Button
								variant="primary"
								size="md"
								type="submit"
								disabled={
									createMutation.isPending ||
									updateMutation.isPending
								}
								loading={
									createMutation.isPending ||
									updateMutation.isPending
								}
							>
								{t("rules.ruleForm.save")}
							</Button>
						</div>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
