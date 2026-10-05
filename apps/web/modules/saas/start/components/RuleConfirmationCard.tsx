"use client";

import type { RuleProposal } from "@repo/api/modules/ai/procedures/rules-assistant";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { useCreateRuleMutation } from "@saas/mailboxes/lib/rules-api";
import { CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

interface RuleConfirmationCardProps {
	rule: RuleProposal;
	toolCallId: string;
	mailboxId: string;
	partState: "input-streaming" | "input-available" | "output-available";
	output?: { action: "accepted" | "rejected" };
	addToolOutput: (args: {
		tool: string;
		toolCallId: string;
		output: unknown;
	}) => Promise<void>;
}

export function RuleConfirmationCard({
	rule,
	toolCallId,
	mailboxId,
	partState,
	output,
	addToolOutput,
}: RuleConfirmationCardProps) {
	const createRuleMutation = useCreateRuleMutation();

	if (partState === "input-streaming") {
		return (
			<Card className="my-2 w-full max-w-xl animate-pulse border-primary/20">
				<CardHeader className="pb-2">
					<div className="h-5 w-32 rounded bg-muted" />
				</CardHeader>
				<CardContent className="space-y-2">
					<div className="h-4 w-full rounded bg-muted" />
					<div className="h-4 w-3/4 rounded bg-muted" />
				</CardContent>
			</Card>
		);
	}

	if (partState === "output-available" && output) {
		const accepted = output.action === "accepted";
		return (
			<Card
				className={`my-2 w-full max-w-xl border ${accepted ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}
			>
				<CardContent className="py-3">
					<p className="text-sm font-medium">
						{accepted ? (
							<span className="flex items-center gap-1 text-success">
								<CheckIcon className="size-4" />
								Rule &quot;{rule.name}&quot; created
							</span>
						) : (
							<span className="flex items-center gap-1 text-muted-foreground">
								<XIcon className="size-4" />
								Rule rejected
							</span>
						)}
					</p>
				</CardContent>
			</Card>
		);
	}

	// input-available — show full card with Accept/Reject buttons
	const { condition, actions } = rule;

	const handleAccept = async () => {
		try {
			const hasStatic =
				condition.staticFrom ||
				condition.staticTo ||
				condition.staticSubject;
			const condOp = condition.conditionalOperator;

			await createRuleMutation.mutateAsync({
				mailboxId,
				data: {
					name: rule.name,
					condition: {
						conditionalOperator:
							condOp === "NONE" || !condOp ? null : condOp,
						aiInstructions: condition.aiInstructions || null,
						static: hasStatic
							? {
									from: condition.staticFrom ?? null,
									to: condition.staticTo ?? null,
									subject: condition.staticSubject ?? null,
								}
							: null,
					},
					actions: actions.map((action) => {
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
						if (action.webhookUrl) {
							fields.webhookUrl = action.webhookUrl;
						}
						if (action.folderName) {
							fields.folderName = action.folderName;
						}
						return {
							type: action.type,
							...(Object.keys(fields).length > 0
								? { fields }
								: {}),
						};
					}),
					enabled: true,
				},
			});

			toast.success(`Rule "${rule.name}" created`);

			await addToolOutput({
				tool: "proposeRule",
				toolCallId,
				output: { action: "accepted" },
			});
		} catch {
			toast.error("Failed to create rule");
		}
	};

	const handleReject = async () => {
		await addToolOutput({
			tool: "proposeRule",
			toolCallId,
			output: { action: "rejected" },
		});
	};

	return (
		<Card className="my-2 w-full max-w-xl border-primary/30">
			<CardHeader className="pb-2">
				<CardTitle className="text-base">
					Proposed rule: {rule.name}
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Condition */}
				<div>
					<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Condition
					</p>
					<div className="space-y-1 text-sm">
						{condition.staticFrom && (
							<p>
								<span className="text-muted-foreground">
									From:
								</span>{" "}
								{condition.staticFrom}
							</p>
						)}
						{condition.staticTo && (
							<p>
								<span className="text-muted-foreground">
									To:
								</span>{" "}
								{condition.staticTo}
							</p>
						)}
						{condition.staticSubject && (
							<p>
								<span className="text-muted-foreground">
									Subject:
								</span>{" "}
								{condition.staticSubject}
							</p>
						)}
						{condition.aiInstructions && (
							<p className="text-muted-foreground italic">
								AI: {condition.aiInstructions}
							</p>
						)}
						{condition.conditionalOperator &&
							condition.conditionalOperator !== "NONE" && (
								<Badge status="info" className="text-xs">
									{condition.conditionalOperator}
								</Badge>
							)}
					</div>
				</div>

				{/* Actions */}
				<div>
					<p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Actions
					</p>
					<div className="flex flex-wrap gap-1">
						{actions.map((action, i) => (
							<Badge key={i}>
								{action.type}
								{action.label ? `: ${action.label}` : ""}
								{action.to ? ` to ${action.to}` : ""}
							</Badge>
						))}
					</div>
				</div>

				{/* Buttons */}
				<div className="flex gap-2 pt-2">
					<Button
						size="sm"
						variant="primary"
						onClick={handleAccept}
						loading={createRuleMutation.isPending}
					>
						<CheckIcon className="mr-1 size-4" />
						Accept
					</Button>
					<Button
						size="sm"
						variant="secondary"
						onClick={handleReject}
						disabled={createRuleMutation.isPending}
					>
						<XIcon className="mr-1 size-4" />
						Reject
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
