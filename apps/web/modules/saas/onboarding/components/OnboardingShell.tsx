"use client";

import { config as i18nConfig } from "@repo/i18n/config";
import { cn, Logo } from "@repo/ui";
import { ColorModeToggle } from "@shared/components/ColorModeToggle";
import { LocaleSwitch } from "@shared/components/LocaleSwitch";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type PropsWithChildren, Suspense } from "react";

export const ONBOARDING_STEPS = [
	"profile",
	"mailboxes",
	"rules",
	"apply",
] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number];

interface OnboardingShellProps {
	currentStep: OnboardingStepKey;
}

function StepNavItem({
	index,
	step,
	currentStep,
}: {
	index: number;
	step: OnboardingStepKey;
	currentStep: OnboardingStepKey;
}) {
	const t = useTranslations();
	const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);
	const isActive = step === currentStep;
	const isDone = index < currentIndex;

	return (
		<div
			className={cn(
				"flex items-start gap-3 rounded-lg p-3 transition-colors",
				isActive && "bg-muted",
			)}
		>
			<span
				className={cn(
					"mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]",
					isDone &&
						"border-primary bg-primary text-primary-foreground",
					isActive &&
						"border-foreground bg-foreground text-background",
					!isActive && !isDone && "border-border text-foreground/60",
				)}
			>
				{isDone ? <CheckIcon className="size-3" /> : index + 1}
			</span>
			<div>
				<h4 className="font-medium text-sm">
					{t(`onboarding.stepNav.${step}.title`)}
				</h4>
				<p className="mt-0.5 text-foreground/60 text-xs">
					{t(`onboarding.stepNav.${step}.description`)}
				</p>
			</div>
		</div>
	);
}

export function OnboardingShell({
	currentStep,
	children,
}: PropsWithChildren<OnboardingShellProps>) {
	const t = useTranslations();
	const currentIndex = ONBOARDING_STEPS.indexOf(currentStep);

	return (
		<div className="flex min-h-screen w-full flex-col">
			<header className="flex items-center justify-between border-b px-6 py-5 md:px-10">
				<Link href="/" className="block">
					<Logo />
				</Link>

				<div className="flex items-center gap-4">
					<span className="hidden text-foreground/60 text-xs sm:inline">
						{t("onboarding.step", {
							step: currentIndex + 1,
							total: ONBOARDING_STEPS.length,
							label: t(`onboarding.stepLabels.${currentStep}`),
						})}
					</span>
					<div className="flex items-center gap-2">
						{Object.keys(i18nConfig.locales).length > 1 && (
							<Suspense>
								<LocaleSwitch withLocaleInUrl={false} />
							</Suspense>
						)}
						<ColorModeToggle />
					</div>
				</div>
			</header>

			<div className="mx-auto grid w-full max-w-5xl flex-1 gap-12 px-6 py-10 md:px-10 md:py-14 lg:grid-cols-[260px_1fr] lg:gap-16">
				<nav className="flex flex-col gap-1 lg:sticky lg:top-24 lg:self-start">
					{ONBOARDING_STEPS.map((step, index) => (
						<StepNavItem
							key={step}
							index={index}
							step={step}
							currentStep={currentStep}
						/>
					))}
				</nav>

				<main className="max-w-2xl">{children}</main>
			</div>
		</div>
	);
}
