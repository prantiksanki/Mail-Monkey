"use client";

import { Badge } from "@repo/ui/components/badge";
import { Card } from "@repo/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import {
	AlertCircleIcon,
	CheckCircle2Icon,
	ClockIcon,
	ExternalLinkIcon,
	MailIcon,
	UserIcon,
	XCircleIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useExecutionLogsQuery } from "../lib/rules-api";

function StatusBadge({
	status,
	t,
}: {
	status: string;
	t: (key: string) => string;
}) {
	return (
		<Badge
			status={
				status === "matched"
					? "success"
					: status === "error"
						? "error"
						: "info"
			}
		>
			{t(`rules.executionLog.status.${status}`)}
		</Badge>
	);
}

function gmailUrl(email: string, messageId: string) {
	return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#inbox/${messageId}`;
}

export function ExecutionLogList() {
	const t = useTranslations();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: mailboxes = [] } = useMailboxesQuery();
	const { data, isLoading } = useExecutionLogsQuery(selectedMailboxId);
	const [selectedLog, setSelectedLog] = useState<any>(null);
	const mailboxEmail =
		mailboxes.find((m) => m.id === selectedMailboxId)?.email ?? "";

	if (!selectedMailboxId) {
		return null;
	}

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
				<Skeleton className="h-16 w-full" />
			</div>
		);
	}

	if (!data?.logs?.length) {
		return (
			<Card className="p-12">
				<div className="text-center">
					<p className="text-muted-foreground">
						{t("rules.executionLog.empty")}
					</p>
				</div>
			</Card>
		);
	}

	const actions = (selectedLog?.actionsRun ?? []) as Array<{
		type: string;
		success: boolean;
		error?: string;
	}>;

	return (
		<>
			<div className="space-y-3">
				{data.logs.map((log: any) => (
					<Card
						key={log.id}
						className="cursor-pointer p-4 transition-colors hover:bg-muted/50"
						onClick={() => setSelectedLog(log)}
					>
						<div className="flex items-center justify-between">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium text-sm">
										{log.rule?.name ?? "Deleted rule"}
									</span>
									<StatusBadge status={log.status} t={t} />
								</div>
								<p className="mt-1 truncate text-muted-foreground text-sm">
									{log.subject} — {log.from}
								</p>
							</div>
							<div className="ml-4 flex shrink-0 items-center gap-2">
								<span className="text-muted-foreground text-xs">
									{new Date(log.createdAt).toLocaleString()}
								</span>
								{mailboxEmail && (
									<a
										href={gmailUrl(
											mailboxEmail,
											log.messageId,
										)}
										target="_blank"
										rel="noopener noreferrer"
										onClick={(e) => e.stopPropagation()}
										className="text-muted-foreground hover:text-foreground transition-colors"
										title="Open in Gmail"
									>
										<ExternalLinkIcon className="h-3.5 w-3.5" />
									</a>
								)}
							</div>
						</div>
					</Card>
				))}
			</div>

			<Dialog
				open={!!selectedLog}
				onOpenChange={(open) => {
					if (!open) {
						setSelectedLog(null);
					}
				}}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<div className="flex items-center gap-3">
							<DialogTitle className="flex-1 truncate">
								{selectedLog?.rule?.name ?? "Deleted rule"}
							</DialogTitle>
							{selectedLog && (
								<StatusBadge
									status={selectedLog.status}
									t={t}
								/>
							)}
						</div>
						{selectedLog && (
							<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
								<ClockIcon className="h-3 w-3" />
								{new Date(
									selectedLog.createdAt,
								).toLocaleString()}
							</div>
						)}
					</DialogHeader>

					{selectedLog && (
						<div className="space-y-5">
							{/* Email info */}
							<div className="rounded-lg border bg-muted/30 p-4 space-y-2.5">
								<div className="flex items-start gap-2.5">
									<MailIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0">
										<p className="text-xs text-muted-foreground">
											{t(
												"rules.executionLog.detail.subject",
											)}
										</p>
										<p className="text-sm font-medium">
											{selectedLog.subject ?? "—"}
										</p>
									</div>
								</div>
								<div className="flex items-start gap-2.5">
									<UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
									<div className="min-w-0">
										<p className="text-xs text-muted-foreground">
											{t(
												"rules.executionLog.detail.from",
											)}
										</p>
										<p className="truncate text-sm">
											{selectedLog.from ?? "—"}
										</p>
									</div>
								</div>
							</div>

							{/* Actions */}
							{actions.length > 0 && (
								<div>
									<h4 className="mb-2.5 font-medium text-sm">
										{t("rules.executionLog.detail.actions")}
									</h4>
									<div className="space-y-1.5">
										{actions.map((action, i) => (
											<div
												key={i}
												className="flex items-center gap-3 rounded-md border px-3 py-2"
											>
												{action.success ? (
													<CheckCircle2Icon className="h-4 w-4 shrink-0 text-success" />
												) : (
													<XCircleIcon className="h-4 w-4 shrink-0 text-destructive" />
												)}
												<span className="flex-1 text-sm">
													{t(
														`rules.ruleForm.actionTypes.${action.type}`,
													)}
												</span>
												{action.error && (
													<span className="truncate text-xs text-destructive max-w-[140px]">
														{action.error}
													</span>
												)}
											</div>
										))}
									</div>
								</div>
							)}

							{/* Error */}
							{selectedLog.error && (
								<div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
									<AlertCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
									<div>
										<p className="font-medium text-destructive text-sm">
											{t(
												"rules.executionLog.detail.error",
											)}
										</p>
										<p className="mt-0.5 text-destructive/80 text-sm">
											{selectedLog.error}
										</p>
									</div>
								</div>
							)}

							{/* Message ID + Gmail link */}
							<div className="flex items-center justify-center gap-2">
								<a
									href={gmailUrl(
										mailboxEmail,
										selectedLog.messageId,
									)}
									target="_blank"
									rel="noopener noreferrer"
									className="flex items-center gap-1.5 text-muted-foreground/60 text-xs font-mono hover:text-foreground transition-colors"
									onClick={(e) => e.stopPropagation()}
								>
									<span>{selectedLog.messageId}</span>
									<ExternalLinkIcon className="h-3 w-3" />
								</a>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
