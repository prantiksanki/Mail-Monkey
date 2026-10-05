"use client";
import { LocaleLink } from "@i18n/routing";
import { config as paymentsConfig } from "@repo/payments/config";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/tabs";
import { usePlanData } from "@saas/payments/hooks/plan-data";
import type { PlanId } from "@saas/payments/types";
import { useLocaleCurrency } from "@shared/hooks/locale-currency";
import { useRouter } from "@shared/hooks/router";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation } from "@tanstack/react-query";
import {
	ArrowRightIcon,
	BadgePercentIcon,
	CheckIcon,
	PhoneIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

const plans = paymentsConfig.plans;

const PLAN_HIERARCHY: Record<string, number> = {
	free: 0,
	pro: 1,
};

export function PricingTable({
	className,
	userId,
	organizationId,
	activePlanId,
}: {
	className?: string;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
}) {
	const t = useTranslations();
	const format = useFormatter();
	const router = useRouter();
	const localeCurrency = useLocaleCurrency();
	const [loading, setLoading] = useState<PlanId | false>(false);
	const [interval, setInterval] = useState<"month" | "year">("month");

	const { planData } = usePlanData();

	const createCheckoutLinkMutation = useMutation(
		orpc.payments.createCheckoutLink.mutationOptions(),
	);

	const onSelectPlan = async (planId: PlanId, productId?: string) => {
		if (!(userId || organizationId)) {
			router.push("/auth/signup");
			return;
		}

		const plan = plans[planId as keyof typeof plans];
		const price =
			"prices" in plan
				? plan.prices?.find((price) => price.productId === productId)
				: undefined;

		if (!price) {
			return;
		}

		setLoading(planId);

		try {
			const { checkoutLink } =
				await createCheckoutLinkMutation.mutateAsync({
					type: "subscription",
					productId: price.productId,
					organizationId,
					redirectUrl: window.location.href,
				});

			window.location.href = checkoutLink;
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	};

	const filteredPlans = Object.entries(plans).filter(([planId]) => {
		if (planId === activePlanId) {
			return false;
		}
		if (activePlanId && planId === "free") {
			return false;
		}
		if (
			activePlanId &&
			(PLAN_HIERARCHY[planId] ?? 0) <= (PLAN_HIERARCHY[activePlanId] ?? 0)
		) {
			return false;
		}
		return true;
	});

	const hasSubscriptions = filteredPlans.some(([_, plan]) =>
		"prices" in plan
			? plan.prices?.some((price) => price.type === "recurring")
			: false,
	);

	if (filteredPlans.length === 0 && activePlanId) {
		return (
			<div className={cn("@container", className)}>
				<p className="text-sm text-muted-foreground">
					{t("pricing.highestPlan")}
				</p>
			</div>
		);
	}

	return (
		<div className={cn("@container", className)}>
			{hasSubscriptions && (
				<div className="mb-6 flex justify-start">
					<Tabs
						value={interval}
						onValueChange={(value) =>
							setInterval(value as typeof interval)
						}
						data-test="price-table-interval-tabs"
					>
						<TabsList className="border-foreground/10">
							<TabsTrigger value="month">
								{t("pricing.monthly")}
							</TabsTrigger>
							<TabsTrigger value="year">
								{t("pricing.yearly")}
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			)}
			<div
				className={cn("grid grid-cols-1 gap-5", {
					"@xl:grid-cols-2": filteredPlans.length >= 2,
					"@3xl:grid-cols-3": filteredPlans.length >= 3,
					"@4xl:grid-cols-4": filteredPlans.length >= 4,
				})}
			>
				{filteredPlans
					.filter(([planId]) => planId !== activePlanId)
					.map(([planId, plan]) => {
						const isFree = "isFree" in plan ? plan.isFree : false;
						const isEnterprise =
							"isEnterprise" in plan ? plan.isEnterprise : false;
						const prices =
							"prices" in plan ? plan.prices : undefined;
						const recommended =
							"recommended" in plan ? plan.recommended : false;
						const hidden = "hidden" in plan ? plan.hidden : false;

						const { title, description, features } =
							planData[planId as keyof typeof planData];

						const price = isFree
							? {
									amount: 0,
									currency: localeCurrency,
									interval,
									productId: "",
									type: "recurring",
								}
							: prices?.find(
									(price) =>
										!hidden &&
										price.interval === interval &&
										price.currency === localeCurrency,
								);

						if (!price && !isEnterprise) {
							return null;
						}

						return (
							<div
								key={planId}
								className={cn(
									"relative rounded-[1.75rem] border border-white/[0.08] bg-white/[0.03] p-7 shadow-[0_22px_80px_rgba(0,0,0,0.18)]",
									{
										"border-primary/40 shadow-[0_24px_90px_var(--primary-soft)]":
											recommended,
									},
								)}
								data-test="price-table-plan"
							>
								{recommended && (
									<div className="-top-3 -translate-x-1/2 absolute left-1/2 rounded-full bg-primary px-3 py-1 font-medium text-[11px] uppercase tracking-[0.16em] text-black">
										{t("pricing.recommended")}
									</div>
								)}
								<div className="flex h-full flex-col justify-between gap-5">
									<div>
										<h3 className="my-0 text-2xl font-semibold tracking-[-0.03em] text-foreground">
											{title}
										</h3>
										{description && (
											<p className="mt-2 text-sm leading-6 text-foreground/60">
												{description}
											</p>
										)}

										{!!features?.length && (
											<ul className="mt-5 grid list-none gap-2.5 text-foreground/70 text-sm">
												{features.map(
													(feature, key) => (
														<li
															key={key}
															className="flex items-start justify-start"
														>
															<CheckIcon className="mt-0.5 mr-2 size-4 shrink-0 text-primary" />
															<span>
																{feature}
															</span>
														</li>
													),
												)}
											</ul>
										)}

										{price &&
											"trialPeriodDays" in price &&
											price.trialPeriodDays && (
												<div className="mt-4 flex items-center justify-start text-sm font-medium text-primary opacity-80">
													<BadgePercentIcon className="mr-2 size-4" />
													{t("pricing.trialPeriod", {
														days: price.trialPeriodDays,
													})}
												</div>
											)}
									</div>

									<div>
										{price && (
											<div
												className="flex items-baseline gap-1.5"
												data-test="price-table-plan-price"
											>
												<span className="text-4xl font-semibold leading-none tracking-[-0.04em] text-foreground lg:text-5xl">
													{format.number(
														price.amount,
														{
															style: "currency",
															currency:
																price.currency,
														},
													)}
												</span>
												{"interval" in price && (
													<span className="text-foreground/50 text-xs">
														{" / "}
														{interval === "month"
															? t(
																	"pricing.month",
																	{
																		count: 1,
																	},
																)
															: t(
																	"pricing.year",
																	{
																		count: 1,
																	},
																)}
													</span>
												)}
												{organizationId &&
													"seatBased" in price &&
													price.seatBased && (
														<span className="text-foreground/50 text-xs">
															{" / "}
															{t(
																"pricing.perSeat",
															)}
														</span>
													)}
											</div>
										)}

										{isEnterprise ? (
											<Button
												className="mt-4 h-12 w-full font-semibold uppercase"
												variant="glass"
												asChild
											>
												<LocaleLink href="/contact">
													<PhoneIcon className="mr-2 size-4" />
													{t("pricing.contactSales")}
												</LocaleLink>
											</Button>
										) : (
											<Button
												className="mt-4 h-12 w-full font-semibold uppercase tracking-[0.08em]"
												variant={
													recommended
														? "primary"
														: "secondary"
												}
												onClick={() =>
													onSelectPlan(
														planId as PlanId,
														price?.productId,
													)
												}
												loading={loading === planId}
											>
												{userId || organizationId
													? t("pricing.choosePlan")
													: t("pricing.getStarted")}
												<ArrowRightIcon className="ml-2 size-4" />
											</Button>
										)}
									</div>
								</div>
							</div>
						);
					})}
			</div>
		</div>
	);
}
