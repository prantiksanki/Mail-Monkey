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
import { useUserPurchases } from "@saas/payments/hooks/purchases";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ZapIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

const DAY_MS = 24 * 60 * 60 * 1000;

/** True for the synthetic, card-free trial purchase created by startTrial. */
function isTrialPurchase(purchase: { customerId: string }) {
	return purchase.customerId === "trial";
}

export function TrialBanner({ onNavigate }: { onNavigate?: () => void }) {
	const t = useTranslations();
	const queryClient = useQueryClient();
	const { purchases, activePlan } = useUserPurchases();
	const [confirmOpen, setConfirmOpen] = useState(false);

	const startTrialMutation = useMutation(
		orpc.payments.startTrial.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.payments.listPurchases.key(),
				});
				toast.success(t("trial.banner.started"));
				setConfirmOpen(false);
			},
			onError: (error) => {
				toast.error(error.message);
				setConfirmOpen(false);
			},
		}),
	);

	const trialPurchase = purchases.find(isTrialPurchase);
	const isTrialing =
		activePlan?.id === "starter" &&
		trialPurchase?.status === "trialing" &&
		!!trialPurchase.trialEndsAt;

	// Paid (Starter or Pro) user with a real subscription, not the trial — no trial CTA.
	if (
		(activePlan?.id === "starter" || activePlan?.id === "pro") &&
		!isTrialing
	) {
		return null;
	}

	if (isTrialing && trialPurchase?.trialEndsAt) {
		const daysLeft = Math.max(
			0,
			Math.ceil(
				(new Date(trialPurchase.trialEndsAt).getTime() - Date.now()) /
					DAY_MS,
			),
		);

		return (
			<div className="px-3 pb-2 shrink-0">
				<Link
					href="/app/settings/billing"
					onClick={onNavigate}
					className="flex items-center justify-between gap-2 rounded-xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) px-3 py-2.5 hover:opacity-80 transition-colors group"
				>
					<div className="flex items-center gap-2">
						<ZapIcon className="size-3.5 text-primary shrink-0" />
						<span className="text-(--sidebar-text) text-xs">
							{t("trial.banner.daysLeft", { days: daysLeft })}
						</span>
					</div>
					<span className="text-(--sidebar-section-label) text-xs">
						›
					</span>
				</Link>
			</div>
		);
	}

	// Free plan, trial not yet started (and never used) — show the CTA.
	if (trialPurchase) {
		return null;
	}

	return (
		<>
			<div className="px-3 pb-2 shrink-0">
				<button
					type="button"
					onClick={() => setConfirmOpen(true)}
					className="w-full flex items-center justify-between gap-2 rounded-xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) px-3 py-2.5 hover:opacity-80 transition-colors group"
				>
					<div className="flex items-center gap-2">
						<ZapIcon className="size-3.5 text-primary shrink-0" />
						<span className="text-(--sidebar-text) text-xs">
							{t("trial.banner.start")}
						</span>
					</div>
					<span className="text-(--sidebar-section-label) text-xs">
						›
					</span>
				</button>
			</div>

			<AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("trial.dialog.title")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("trial.dialog.description")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel
							disabled={startTrialMutation.isPending}
						>
							{t("trial.dialog.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								startTrialMutation.mutate({});
							}}
							disabled={startTrialMutation.isPending}
						>
							{t("trial.dialog.confirm")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
