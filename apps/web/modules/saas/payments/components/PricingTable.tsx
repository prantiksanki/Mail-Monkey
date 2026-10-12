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
	starter: 1,
	pro: 2,
};

export function PricingTable({
	className,
	userId,
	organizationId,
	activePlanId,
	variant = "default",
}: {
	className?: string;
	userId?: string;
	organizationId?: string;
	activePlanId?: string;
	/** "marketing" matches the landing page's dark-blue pricing section look. */
	variant?: "default" | "marketing";
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
		// No usable free tier — never offer it as a selectable plan.
		if (planId === "free") {
			return false;
		}
		if (planId === activePlanId) {
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

	const isMarketing = variant === "marketing";

	return (
		<div className={cn("@container", className)}>
			<div className="relative">
				{hasSubscriptions && (
					<div
						className={cn(
							"mb-6 flex",
							isMarketing ? "justify-center" : "justify-start",
						)}
					>
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
							const isFree =
								"isFree" in plan ? plan.isFree : false;
							const isEnterprise =
								"isEnterprise" in plan
									? plan.isEnterprise
									: false;
							const prices =
								"prices" in plan ? plan.prices : undefined;
							const recommended =
								"recommended" in plan
									? plan.recommended
									: false;
							const hidden =
								"hidden" in plan ? plan.hidden : false;

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
										"relative flex flex-col rounded-[28px] p-7 transition-all duration-300",
										isMarketing
											? recommended
												? "border border-white/20 bg-[#00388F] shadow-[0_0_60px_-12px_rgba(0,56,143,0.35)]"
												: "border border-[#00388F]/15 bg-[hsl(214,95%,44%)] shadow-[0_22px_80px_rgba(0,56,143,0.2)] hover:bg-[hsl(214,90%,40%)]"
											: cn(
													"border border-border bg-card shadow-[0_22px_80px_rgba(0,0,0,0.06)]",
													recommended &&
														"border-primary/40 shadow-[0_24px_90px_var(--primary-soft)]",
												),
									)}
									data-test="price-table-plan"
								>
									{recommended && (
										<div
											className={cn(
												"-top-3 -translate-x-1/2 absolute left-1/2 rounded-full px-3 py-1 font-medium text-[11px] uppercase tracking-[0.16em]",
												isMarketing
													? "bg-white text-[hsl(214,95%,44%)]"
													: "bg-primary text-primary-foreground",
											)}
										>
											{t("pricing.recommended")}
										</div>
									)}
									<div className="flex h-full flex-col justify-between gap-5">
										<div>
											<h3
												className={cn(
													"my-0 text-2xl font-semibold tracking-[-0.03em]",
													isMarketing
														? "text-white"
														: "text-foreground",
												)}
											>
												{title}
											</h3>
											{description && (
												<p
													className={cn(
														"mt-2 text-sm leading-6",
														isMarketing
															? "text-white/70"
															: "text-foreground/60",
													)}
												>
													{description}
												</p>
											)}

											{!!features?.length && (
												<ul
													className={cn(
														"mt-5 grid list-none gap-2.5 text-sm",
														isMarketing
															? "text-white/85"
															: "text-foreground/70",
													)}
												>
													{features.map(
														(feature, key) => (
															<li
																key={key}
																className="flex items-start justify-start"
															>
																<CheckIcon
																	className={cn(
																		"mt-0.5 mr-2 size-4 shrink-0",
																		isMarketing
																			? "text-white/70"
																			: "text-primary",
																	)}
																/>
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
													<div
														className={cn(
															"mt-4 flex items-center justify-start text-sm font-medium",
															isMarketing
																? "text-white/85"
																: "text-primary opacity-80",
														)}
													>
														<BadgePercentIcon className="mr-2 size-4" />
														{t(
															"pricing.trialPeriod",
															{
																days: price.trialPeriodDays,
															},
														)}
													</div>
												)}
										</div>

										<div>
											{price && (
												<div
													className="flex items-baseline gap-1.5"
													data-test="price-table-plan-price"
												>
													<span
														className={cn(
															"text-4xl font-semibold leading-none tracking-[-0.04em] lg:text-5xl",
															isMarketing
																? "text-white"
																: "text-foreground",
														)}
													>
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
														<span
															className={cn(
																"text-xs",
																isMarketing
																	? "text-white/60"
																	: "text-foreground/50",
															)}
														>
															{" / "}
															{interval ===
															"month"
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
															<span
																className={cn(
																	"text-xs",
																	isMarketing
																		? "text-white/60"
																		: "text-foreground/50",
																)}
															>
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
														{t(
															"pricing.contactSales",
														)}
													</LocaleLink>
												</Button>
											) : (
												<Button
													className={cn(
														"mt-4 h-12 w-full font-semibold uppercase tracking-[0.08em]",
														isMarketing &&
															(recommended
																? "bg-white text-[hsl(214,95%,44%)] shadow-[0_4px_24px_-4px_rgba(255,255,255,0.35)] hover:bg-white/90"
																: "bg-white text-[hsl(214,95%,44%)] shadow-[0_4px_24px_-4px_rgba(0,56,143,0.3)] hover:bg-white/90"),
													)}
													variant={
														isMarketing
															? undefined
															: recommended
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
														? t(
																"pricing.choosePlan",
															)
														: t(
																"pricing.getStarted",
															)}
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
		</div>
	);
}
