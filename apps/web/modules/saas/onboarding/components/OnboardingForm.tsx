"use client";

import { useRouter } from "@shared/hooks/router";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { withQuery } from "ufo";
import {
	ONBOARDING_STEPS,
	OnboardingShell,
	type OnboardingStepKey,
} from "./OnboardingShell";
import { OnboardingStepApply } from "./OnboardingStepApply";
import { OnboardingStepMailboxes } from "./OnboardingStepMailboxes";
import { OnboardingStepProfile } from "./OnboardingStepProfile";
import { OnboardingStepRules } from "./OnboardingStepRules";

function parseStep(raw: string | null): OnboardingStepKey {
	if (raw && (ONBOARDING_STEPS as readonly string[]).includes(raw)) {
		return raw as OnboardingStepKey;
	}
	return "profile";
}

export function OnboardingForm({ mailboxId }: { mailboxId: string | null }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const currentStep = parseStep(searchParams.get("step"));

	const goToStep = useCallback(
		(step: OnboardingStepKey) => {
			const next = new URLSearchParams(searchParams.toString());
			next.set("step", step);
			router.replace(withQuery("", Object.fromEntries(next.entries())));
		},
		[router, searchParams],
	);

	return (
		<OnboardingShell currentStep={currentStep}>
			{currentStep === "profile" && (
				<OnboardingStepProfile
					onCompleted={() => goToStep("mailboxes")}
				/>
			)}
			{currentStep === "mailboxes" && (
				<OnboardingStepMailboxes
					onBack={() => goToStep("profile")}
					onCompleted={() => goToStep("rules")}
				/>
			)}
			{currentStep === "rules" && (
				<OnboardingStepRules
					mailboxId={mailboxId}
					onBack={() => goToStep("mailboxes")}
					onCompleted={() => goToStep("apply")}
				/>
			)}
			{currentStep === "apply" && (
				<OnboardingStepApply
					mailboxId={mailboxId}
					onBack={() => goToStep("rules")}
				/>
			)}
		</OnboardingShell>
	);
}
