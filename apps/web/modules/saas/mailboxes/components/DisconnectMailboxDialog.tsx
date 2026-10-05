"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useDisconnectMailboxMutation } from "../lib/api";

interface DisconnectMailboxDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mailboxId: string;
	mailboxEmail: string;
}

export function DisconnectMailboxDialog({
	open,
	onOpenChange,
	mailboxId,
	mailboxEmail,
}: DisconnectMailboxDialogProps) {
	const t = useTranslations();
	const disconnect = useDisconnectMailboxMutation();

	const handleDisconnect = async () => {
		try {
			await disconnect.mutateAsync({ mailboxId });
			toast.success(
				t("mailboxes.disconnectDialog.success", {
					email: mailboxEmail,
				}),
			);
			onOpenChange(false);
		} catch {
			toast.error(t("mailboxes.disconnectDialog.error"));
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>
						{t("mailboxes.disconnectDialog.title", {
							email: mailboxEmail,
						})}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("mailboxes.disconnectDialog.description")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>
						{t("mailboxes.disconnectDialog.cancel")}
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDisconnect}
						disabled={disconnect.isPending}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{disconnect.isPending
							? t("mailboxes.disconnectDialog.disconnecting")
							: t("mailboxes.disconnectDialog.confirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
