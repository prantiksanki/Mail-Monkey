"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/dialog";
import { Skeleton } from "@repo/ui/components/skeleton";
import { buildEmailSrcDoc } from "@saas/mailboxes/lib/email-html";
import {
	useDownloadAttachmentMutation,
	usePaymentCardQuery,
} from "@saas/payment-tracking/lib/payment-tracking-api";
import { MailIcon, PaperclipIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef } from "react";

function formatFileSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(0)} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateTime(iso: string): string {
	return new Date(iso).toLocaleString(undefined, {
		weekday: "short",
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatAmount(
	amount: number | null,
	currency: string | null,
): string | null {
	if (amount === null) {
		return null;
	}
	if (currency) {
		try {
			return new Intl.NumberFormat(undefined, {
				style: "currency",
				currency,
			}).format(amount);
		} catch {
			// Unrecognized currency code — fall through.
		}
	}
	return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function PaymentDetailDialog({
	cardId,
	onOpenChange,
}: {
	cardId: string | null;
	onOpenChange: (open: boolean) => void;
}) {
	const { data, isLoading } = usePaymentCardQuery(cardId);
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const downloadMutation = useDownloadAttachmentMutation();
	const router = useRouter();

	const openInMail = () => {
		if (!data) {
			return;
		}
		onOpenChange(false);
		router.push(
			`/app/mailboxes?folder=inbox&message=${encodeURIComponent(data.emailId)}`,
		);
	};

	const srcDoc = useMemo(
		() => (data?.bodyHtml ? buildEmailSrcDoc(data.bodyHtml) : ""),
		[data?.bodyHtml],
	);

	const amountLabel = data ? formatAmount(data.amount, data.currency) : null;

	return (
		<Dialog open={!!cardId} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
				{isLoading || !data ? (
					<div className="space-y-3">
						<Skeleton className="h-6 w-2/3" />
						<Skeleton className="h-4 w-1/2" />
						<Skeleton className="h-64 w-full" />
					</div>
				) : (
					<>
						<DialogHeader>
							<DialogTitle>{data.subject}</DialogTitle>
						</DialogHeader>

						<div className="space-y-1 text-sm">
							<div>
								<span className="text-muted-foreground">
									From:{" "}
								</span>
								{data.from} &lt;{data.fromEmail}&gt;
							</div>
							<div>
								<span className="text-muted-foreground">
									To:{" "}
								</span>
								{data.to}
							</div>
							<div>
								<span className="text-muted-foreground">
									Received:{" "}
								</span>
								{formatDateTime(data.receivedAt)}
							</div>
							{data.dueDate && (
								<div>
									<span className="text-muted-foreground">
										Due:{" "}
									</span>
									{formatDateTime(data.dueDate)}
								</div>
							)}
							<div>
								<span className="text-muted-foreground">
									Source:{" "}
								</span>
								{data.provider === "GOOGLE"
									? "Gmail"
									: "Outlook"}{" "}
								· {data.mailboxEmail}
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-2">
							{amountLabel && (
								<span className="text-lg font-semibold text-foreground">
									{amountLabel}
								</span>
							)}
							{data.merchant && (
								<Badge status="info" className="normal-case">
									{data.merchant}
								</Badge>
							)}
							<Badge
								status={
									data.kanbanStatus === "OVERDUE"
										? "error"
										: "success"
								}
								className="normal-case"
							>
								{data.kanbanStatus
									.replace("_", " ")
									.toLowerCase()}
							</Badge>
						</div>

						{data.attachments.length > 0 && (
							<div className="space-y-1.5 border-t border-border pt-3">
								<div className="text-xs font-medium text-muted-foreground">
									Attachments ({data.attachments.length})
								</div>
								{data.attachments.map((attachment) => (
									<div
										key={attachment.attachmentId}
										className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
									>
										<div className="flex min-w-0 items-center gap-2">
											<PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
											<span className="truncate text-sm">
												{attachment.filename}
											</span>
											<span className="shrink-0 text-xs text-muted-foreground">
												{formatFileSize(
													attachment.size,
												)}
											</span>
										</div>
										<Button
											variant="outline"
											size="sm"
											disabled={
												downloadMutation.isPending
											}
											onClick={() =>
												downloadMutation.mutate({
													cardId: data.id,
													attachmentId:
														attachment.attachmentId,
													filename:
														attachment.filename,
													mimeType:
														attachment.mimeType,
												})
											}
										>
											Download
										</Button>
									</div>
								))}
							</div>
						)}

						<div className="border-t border-border pt-4">
							<Button
								variant="primary"
								size="sm"
								onClick={openInMail}
								className="mb-3"
							>
								<MailIcon className="mr-1.5 size-4" />
								Go to email
							</Button>
							{data.bodyHtml ? (
								<iframe
									ref={iframeRef}
									srcDoc={srcDoc}
									title="Email content"
									sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
									referrerPolicy="no-referrer"
									className="min-h-[300px] w-full rounded border-0"
								/>
							) : data.bodyText ? (
								<pre className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
									{data.bodyText}
								</pre>
							) : (
								<p className="text-sm text-muted-foreground italic">
									(No readable content — this email may
									contain only attachments.)
								</p>
							)}
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
