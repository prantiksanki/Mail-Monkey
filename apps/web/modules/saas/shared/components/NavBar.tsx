"use client";

import {
	CATEGORY_COLORS,
	categoryForRuleName,
} from "@repo/api/modules/mailboxes/rule-templates";
import { authClient } from "@repo/auth/client";
import { config as paymentsConfig } from "@repo/payments/config";
import { cn, Logo } from "@repo/ui";
import { isStagingEnvironment } from "@repo/utils";
import { useSession } from "@saas/auth/hooks/use-session";
import {
	useDraftsQuery,
	useLabelCountsQuery,
} from "@saas/mailboxes/lib/inbox-api";
import { useRulesQuery } from "@saas/mailboxes/lib/rules-api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { TrialBanner } from "@saas/payments/components/TrialBanner";
import { clearClientStateOnLogout } from "@saas/shared/lib/clear-client-state";
import { NotificationBell } from "@shared/components/NotificationBell";
import { ThemeToggle } from "@shared/components/ThemeToggle";
import { UserAvatar } from "@shared/components/UserAvatar";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import {
	ActivityIcon,
	AlarmClockIcon,
	Building2Icon,
	CalendarCheckIcon,
	CalendarClockIcon,
	CalendarDaysIcon,
	ChevronDownIcon,
	CreditCardIcon,
	InboxIcon,
	LayoutDashboardIcon,
	LayoutGridIcon,
	LinkIcon,
	ListFilterIcon,
	ListIcon,
	LogOutIcon,
	MailIcon,
	MailsIcon,
	MenuIcon,
	MoonIcon,
	PaletteIcon,
	PencilIcon,
	PlugIcon,
	PlusIcon,
	SendIcon,
	Settings2Icon,
	SettingsIcon,
	ShieldCheckIcon,
	SparklesIcon,
	SunIcon,
	Trash2Icon,
	TriangleAlertIcon,
	UserCogIcon,
	UserIcon,
	XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { config as webConfig } from "@/config";
import { useSidebar } from "../lib/sidebar-context";

// Gmail-allowed label backgrounds. Kept byte-for-byte in sync with
// packages/api/.../lib/label-colors.ts so the sidebar dot matches the colour
// Gmail actually renders for the same label.
const LABEL_COLORS = [
	"#fb4c2f",
	"#ffad47",
	"#fad165",
	"#16a766",
	"#4a86e8",
	"#a479e2",
	"#f691b3",
	"#2da2bb",
	"#b99aff",
	"#8a63d2",
];

function labelColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	return LABEL_COLORS[Math.abs(hash) % LABEL_COLORS.length];
}

function TopNavItem({
	icon: Icon,
	label,
	isActive,
	onClick,
	badge,
	expanded,
	collapsed,
}: {
	icon: React.ElementType;
	label: string;
	isActive: boolean;
	onClick: () => void;
	badge?: React.ReactNode;
	/** When set, renders a chevron that rotates to reflect open/closed state. */
	expanded?: boolean;
	/** When set, renders icon-only (sidebar collapsed to a rail). */
	collapsed?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={collapsed ? label : undefined}
			className={cn(
				"w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
				collapsed && "justify-center px-0 py-3",
				isActive
					? "bg-primary text-primary-foreground"
					: "text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text)",
			)}
		>
			<Icon
				className={cn(
					"shrink-0",
					collapsed ? "size-5" : "size-4",
					isActive ? "text-white" : "text-(--sidebar-text-muted)",
				)}
			/>
			{!collapsed && (
				<>
					<span className="flex-1 text-left">{label}</span>
					{badge}
					{expanded !== undefined && (
						<ChevronDownIcon
							className={cn(
								"size-3.5 shrink-0 transition-transform",
								isActive
									? "text-white"
									: "text-(--sidebar-text-muted)",
								expanded ? "rotate-0" : "-rotate-90",
							)}
						/>
					)}
				</>
			)}
		</button>
	);
}

function SubNavItem({
	href,
	label,
	isActive,
	onClick,
	icon: Icon,
	dot,
	dotColor,
	count,
	collapsed,
}: {
	href: string;
	label: string;
	isActive: boolean;
	onClick?: () => void;
	icon?: React.ElementType;
	dot?: boolean;
	dotColor?: string;
	count?: number;
	/** When set, renders icon-only (sidebar collapsed to a rail). */
	collapsed?: boolean;
}) {
	return (
		<Link
			href={href}
			prefetch
			onClick={onClick}
			title={collapsed ? label : undefined}
			className={cn(
				"flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
				collapsed && "justify-center px-0 py-2.5",
				isActive
					? "bg-primary text-primary-foreground"
					: "bg-(--sidebar-item-bg) text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text)",
			)}
		>
			{Icon && (
				<Icon
					className={cn(
						"shrink-0",
						collapsed ? "size-4.5" : "size-3.5",
						isActive ? "text-white" : "text-(--sidebar-text-muted)",
					)}
				/>
			)}
			{!collapsed && dot && dotColor && (
				<span
					className="size-2 rounded-full shrink-0 bg-(--dot-color)"
					style={{ "--dot-color": dotColor } as React.CSSProperties}
				/>
			)}
			{!collapsed && <span className="truncate">{label}</span>}
			{!collapsed && count !== undefined && count > 0 && (
				<span className="ml-auto shrink-0 tabular-nums rounded-full bg-(--sidebar-badge-bg) px-1.5 py-0.5 text-[11px] font-semibold text-(--sidebar-badge-text)">
					{count}
				</span>
			)}
		</Link>
	);
}

function NewBadge() {
	return (
		<span className="ml-auto shrink-0 rounded-full bg-(--sidebar-badge-bg) px-1.5 py-0.5 text-[10px] font-semibold text-(--sidebar-badge-text)">
			New
		</span>
	);
}

export function NavBar() {
	const t = useTranslations();
	const router = useRouter();
	const pathname = usePathname();
	const { user } = useSession();
	const { activeOrganization, isOrganizationAdmin } = useActiveOrganization();
	const { isMobileOpen, setIsMobileOpen, isCollapsed, toggleCollapsed } =
		useSidebar();
	// The mobile drawer reuses this same markup as an overlay; it should
	// always show full labels regardless of the desktop collapse preference.
	const effectiveCollapsed = isCollapsed && !isMobileOpen;
	const searchParams = useSearchParams();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: rulesData } = useRulesQuery(selectedMailboxId);
	const { data: labelCountsData } = useLabelCountsQuery(selectedMailboxId);
	const { data: draftsData } = useDraftsQuery(selectedMailboxId);
	const { theme } = useTheme();

	const accountType = user?.accountType as
		| "STANDARD"
		| "FREELANCER"
		| "CREATOR"
		| undefined;
	const { data: creatorProfileData } = useQuery({
		...orpc.creatorProfiles.me.queryOptions(),
		enabled: !!accountType && accountType !== "STANDARD",
	});
	const isCreatorProfileEnabled = creatorProfileData?.enabled ?? false;

	// Which top-level section is expanded
	const [openSection, setOpenSection] = useState<string | null>(() => {
		if (
			pathname.startsWith("/app/mailboxes") ||
			pathname.startsWith("/app/bookings")
		) {
			return "mail";
		}
		if (pathname.startsWith("/app/calendar")) {
			return "calendar";
		}
		if (
			pathname.startsWith("/app/rules") ||
			pathname.startsWith("/app/activity")
		) {
			return "rules";
		}
		if (pathname.startsWith("/app/rules/assistant")) {
			return "ai";
		}
		if (pathname.startsWith("/app/settings/my-page")) {
			return "my-page";
		}
		if (
			pathname.startsWith("/app/settings") ||
			pathname.startsWith("/app/admin")
		) {
			return "settings";
		}
		return null;
	});

	const toggleSection = (key: string) => {
		setOpenSection((prev) => (prev === key ? null : key));
	};

	// Close the user profile panel when clicking outside of it.
	const userRowRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (openSection !== "user") {
			return;
		}
		function handlePointerDown(event: PointerEvent) {
			if (
				userRowRef.current &&
				!userRowRef.current.contains(event.target as Node)
			) {
				setOpenSection(null);
			}
		}
		document.addEventListener("pointerdown", handlePointerDown);
		return () =>
			document.removeEventListener("pointerdown", handlePointerDown);
	}, [openSection]);

	const labelRules = (() => {
		const all = (rulesData?.rules ?? [])
			.filter((r) =>
				(
					r as unknown as {
						actions: Array<{
							type: string;
							fields?: Record<string, unknown>;
						}>;
					}
				).actions.some((a) => a.type === "LABEL" && a.fields?.label),
			)
			.map((r) => {
				const rule = r as unknown as {
					id: string;
					name: string;
					actions: Array<{
						type: string;
						fields?: Record<string, unknown>;
					}>;
				};
				const labelAction = rule.actions.find(
					(a) => a.type === "LABEL",
				);
				const labelName =
					(labelAction?.fields?.label as string) ?? rule.name;
				// Match the Rules-page category tag color when the rule came
				// from a template; fall back to the hash color for custom rules.
				const category = categoryForRuleName(rule.name);
				return {
					id: rule.id,
					name: labelName,
					color: category
						? CATEGORY_COLORS[category]
						: labelColor(labelName),
				};
			});
		// One chip per label name (case-insensitive) — guards against legacy
		// data where multiple rules created the same label.
		const seen = new Set<string>();
		const deduped = all.filter((label) => {
			const key = label.name.trim().toLowerCase();
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
		// Custom (IMAP) mailboxes: the account's own folders are its labels.
		for (const name of labelCountsData?.folderLabels ?? []) {
			const key = name.trim().toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				deduped.push({
					id: `folder:${name}`,
					name,
					color: labelColor(name),
				});
			}
		}
		return deduped;
	})();

	const { useSidebarLayout } = webConfig.saas;

	const basePath = activeOrganization
		? `/app/${activeOrganization.slug}`
		: "/app";

	const onLogout = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
					clearClientStateOnLogout();
					window.location.href = new URL(
						webConfig.saas.redirectAfterLogout,
						window.location.origin,
					).toString();
				},
			},
		});
	};

	const close = () => setIsMobileOpen(false);

	if (!useSidebarLayout) {
		return (
			<nav className="w-full bg-card border-b">
				<div className="container max-w-6xl py-4 flex items-center justify-between gap-6">
					<Link href="/app" className="block">
						<Logo withLabel={true} />
					</Link>
					<ul className="flex list-none items-center gap-2 text-sm">
						{[
							{
								label: t("app.menu.dashboard"),
								href: basePath,
								isActive: pathname === basePath,
							},
							{
								label: "Mail",
								href: "/app/mailboxes?folder=inbox",
								isActive: pathname.startsWith("/app/mailboxes"),
							},
							{
								label: t("app.menu.calendar"),
								href: "/app/calendar",
								isActive: pathname.startsWith("/app/calendar"),
							},
							{
								label: t("app.menu.rules"),
								href: "/app/rules",
								isActive:
									pathname.startsWith("/app/rules") &&
									!pathname.startsWith(
										"/app/rules/assistant",
									),
							},
							{
								label: t("app.menu.aiAssistant"),
								href: "/app/rules/assistant",
								isActive: pathname.startsWith(
									"/app/rules/assistant",
								),
							},
						].map((item) => (
							<li key={item.href}>
								<Link
									href={item.href}
									className={cn(
										"flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
										item.isActive
											? "font-semibold bg-card border border-border"
											: "hover:bg-muted/50",
									)}
								>
									<span>{item.label}</span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			</nav>
		);
	}

	// Active section detection
	const isDashboard = pathname === basePath || pathname === "/app";
	const isMail = pathname.startsWith("/app/mailboxes");
	const isBookings = pathname.startsWith("/app/bookings");
	const isCalendar = pathname.startsWith("/app/calendar");
	const isPaymentTracking = pathname.startsWith("/app/payment-tracking");
	const isRules =
		pathname.startsWith("/app/rules") &&
		!pathname.startsWith("/app/rules/assistant");
	const isActivity = pathname.startsWith("/app/activity");
	const isAI = pathname.startsWith("/app/rules/assistant");
	const isMyPage = pathname.startsWith("/app/settings/my-page");
	const isSettings =
		(pathname.startsWith("/app/settings") && !isMyPage) ||
		pathname.startsWith("/app/admin");

	const currentFolder = searchParams.get("folder") ?? "inbox";
	const currentLabel = searchParams.get("label");

	const isStaging = isStagingEnvironment();
	// No billing UI on staging or when the app is free for everyone.
	const hideBilling = isStaging || paymentsConfig.freeAccess;

	const settingsItems = [
		{
			label: "General",
			href: "/app/settings/general",
			icon: Settings2Icon,
		},
		{
			label: "Integrations",
			href: "/app/settings/integrations",
			icon: PlugIcon,
		},
		...(activeOrganization && isOrganizationAdmin
			? [
					{
						label: "Organization",
						href: `${basePath}/settings`,
						icon: Building2Icon,
					},
				]
			: []),
		...(hideBilling
			? []
			: [
					{
						label: "Billing",
						href: "/app/settings/billing",
						icon: CreditCardIcon,
					},
				]),
		{
			label: "Security",
			href: "/app/settings/security",
			icon: ShieldCheckIcon,
		},
		{
			label: "Danger Zone",
			href: "/app/settings/danger-zone",
			icon: TriangleAlertIcon,
		},
		...(user?.role === "admin"
			? [
					{
						label: "Admin",
						href: "/app/admin",
						icon: UserCogIcon,
					},
				]
			: []),
	];

	const myPageItems = [
		{
			label: "Profile",
			href: "/app/settings/my-page/profile",
			icon: UserIcon,
		},
		{
			label: "Links",
			href: "/app/settings/my-page/links",
			icon: LinkIcon,
		},
		{
			label: "Booking",
			href: "/app/settings/my-page/booking",
			icon: CalendarCheckIcon,
		},
		{
			label: "Design",
			href: "/app/settings/my-page/design",
			icon: PaletteIcon,
		},
	];

	const sidebarContent = (
		<div className="flex flex-col h-full">
			{/* Logo */}
			<div
				className={cn(
					"px-4 py-4 shrink-0 flex items-center gap-1",
					effectiveCollapsed
						? "md:flex-col md:justify-center md:px-2"
						: "justify-between",
				)}
			>
				<Link
					href="/app"
					className={cn(
						"flex items-center",
						effectiveCollapsed && "md:hidden",
					)}
					onClick={close}
				>
					<Logo withLabel={true} />
				</Link>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={toggleCollapsed}
						aria-label={
							isCollapsed ? "Expand sidebar" : "Collapse sidebar"
						}
						className="hidden md:flex items-center justify-center size-8 rounded-lg text-(--sidebar-text-muted) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text) transition-colors shrink-0"
						// Browser password-manager/autofill extensions (e.g. LastPass)
						// inject a fdprocessedid attribute into buttons before React
						// hydrates, which otherwise trips Next's hydration-mismatch
						// overlay on every load — harmless, so silence it here.
						suppressHydrationWarning
					>
						<MenuIcon className="size-5" />
					</button>
				</div>
			</div>

			{/* Nav items */}
			<nav
				className={cn(
					"flex-1 overflow-y-auto no-scrollbar px-2 pb-4",
					effectiveCollapsed ? "space-y-2.5" : "space-y-0.5",
				)}
			>
				{/* Notifications */}
				<NotificationBell collapsed={effectiveCollapsed} />

				{/* 1. Dashboard */}
				<TopNavItem
					icon={LayoutDashboardIcon}
					label={t("app.menu.dashboard")}
					isActive={isDashboard}
					collapsed={effectiveCollapsed}
					onClick={() => {
						router.push(basePath);
						close();
					}}
				/>

				{/* 2. Mail */}
				<TopNavItem
					icon={MailIcon}
					label="Mail"
					isActive={isMail || isBookings}
					expanded={openSection === "mail"}
					collapsed={effectiveCollapsed}
					onClick={() => toggleSection("mail")}
				/>
				{openSection === "mail" && (
					<div className="space-y-0.5 pb-1">
						<Link
							href="/app/mailboxes?folder=inbox&compose=true"
							onClick={close}
							title={effectiveCollapsed ? "Compose" : undefined}
							className={cn(
								"flex items-center gap-2 my-1 px-3 py-1.5 rounded-md bg-info hover:bg-info/90 text-info-foreground text-[13px] font-semibold transition-colors",
								effectiveCollapsed &&
									"justify-center px-0 py-2.5",
							)}
						>
							<PencilIcon
								className={cn(
									"text-info-foreground",
									effectiveCollapsed
										? "size-4.5"
										: "size-3.5",
								)}
							/>
							{!effectiveCollapsed && "Compose"}
						</Link>
						{[
							{
								label: "Inbox",
								href: "/app/mailboxes?folder=inbox",
								folder: "inbox",
								icon: InboxIcon,
							},
							{
								label: "All Emails",
								href: "/app/mailboxes?folder=all",
								folder: "all",
								icon: MailsIcon,
							},
							{
								label: "Sent",
								href: "/app/mailboxes?folder=sent",
								folder: "sent",
								icon: SendIcon,
							},
							{
								label: "Drafts",
								href: "/app/mailboxes?folder=drafts",
								folder: "drafts",
								icon: MailIcon,
							},
							{
								label: "Trash",
								href: "/app/mailboxes?folder=trash",
								folder: "trash",
								icon: Trash2Icon,
							},
							{
								label: "Scheduled",
								href: "/app/mailboxes?folder=scheduled",
								folder: "scheduled",
								icon: CalendarClockIcon,
							},
							{
								label: "Snoozed",
								href: "/app/mailboxes?folder=snoozed",
								folder: "snoozed",
								icon: AlarmClockIcon,
							},
						].map((item) => (
							<SubNavItem
								key={item.folder}
								href={item.href}
								label={item.label}
								icon={item.icon}
								collapsed={effectiveCollapsed}
								count={
									item.folder === "inbox"
										? labelCountsData?.inboxUnreadCount
										: item.folder === "drafts"
											? draftsData?.drafts.length
											: undefined
								}
								isActive={
									isMail &&
									currentFolder === item.folder &&
									// "All Emails" shares folder=all with label views;
									// only highlight it when no label is selected.
									(item.folder !== "all" || !currentLabel)
								}
								onClick={close}
							/>
						))}

						{isCreatorProfileEnabled && (
							<SubNavItem
								href="/app/bookings"
								label="Bookings"
								icon={CalendarCheckIcon}
								collapsed={effectiveCollapsed}
								isActive={isBookings}
								onClick={close}
							/>
						)}

						{/* Labels sub-section */}
						{labelRules.length > 0 && (
							<>
								<div
									className={cn(
										"flex items-center justify-between px-3 mt-3 mb-1",
										effectiveCollapsed &&
											"md:justify-center md:px-0",
									)}
								>
									{!effectiveCollapsed && (
										<span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--sidebar-section-label)">
											Labels
										</span>
									)}
									<Link
										href="/app/rules"
										onClick={close}
										title={
											effectiveCollapsed
												? "Manage labels"
												: undefined
										}
										className="text-(--sidebar-section-label) hover:text-(--sidebar-item-active-text) transition-colors"
										aria-label="Manage labels"
									>
										<PlusIcon className="size-3" />
									</Link>
								</div>
								{labelRules.map((label) => (
									<SubNavItem
										key={label.id}
										href={`/app/mailboxes?folder=all&label=${encodeURIComponent(label.name)}`}
										label={label.name}
										collapsed={effectiveCollapsed}
										isActive={
											isMail &&
											currentLabel === label.name
										}
										onClick={close}
										dot
										dotColor={label.color}
										count={
											labelCountsData?.counts[label.name]
										}
									/>
								))}
							</>
						)}
					</div>
				)}

				{/* 3. Calendar */}
				<TopNavItem
					icon={CalendarDaysIcon}
					label={t("app.menu.calendar")}
					isActive={isCalendar}
					collapsed={effectiveCollapsed}
					onClick={() => {
						router.push("/app/calendar");
						close();
					}}
				/>

				{/* 3.5 Payments */}
				<TopNavItem
					icon={CreditCardIcon}
					label={t("app.menu.payments")}
					isActive={isPaymentTracking}
					collapsed={effectiveCollapsed}
					onClick={() => {
						router.push("/app/payment-tracking");
						close();
					}}
				/>

				{/* 4. Rules */}
				<TopNavItem
					icon={ListFilterIcon}
					label={t("app.menu.rules")}
					isActive={isRules}
					expanded={openSection === "rules"}
					collapsed={effectiveCollapsed}
					onClick={() => toggleSection("rules")}
				/>
				{openSection === "rules" && (
					<div className="space-y-0.5 pb-1">
						<SubNavItem
							href="/app/rules"
							label="All Rules"
							icon={ListIcon}
							isActive={isRules}
							collapsed={effectiveCollapsed}
							onClick={close}
						/>
						<SubNavItem
							href="/app/activity"
							label={t("app.menu.activity")}
							icon={ActivityIcon}
							isActive={isActivity}
							collapsed={effectiveCollapsed}
							onClick={close}
						/>
					</div>
				)}

				{/* 5. AI Assistant */}
				<TopNavItem
					icon={SparklesIcon}
					label={t("app.menu.aiAssistant")}
					isActive={isAI}
					badge={<NewBadge />}
					collapsed={effectiveCollapsed}
					onClick={() => {
						router.push("/app/rules/assistant");
						close();
					}}
				/>

				{/* 6. My Page */}
				{accountType && accountType !== "STANDARD" && (
					<>
						<TopNavItem
							icon={LayoutDashboardIcon}
							label="My Page"
							isActive={isMyPage}
							expanded={openSection === "my-page"}
							collapsed={effectiveCollapsed}
							onClick={() => toggleSection("my-page")}
						/>
						{openSection === "my-page" && (
							<div className="space-y-0.5 pb-1">
								{myPageItems.map((item) => (
									<SubNavItem
										key={item.href}
										href={item.href}
										label={item.label}
										icon={item.icon}
										isActive={pathname.startsWith(
											item.href,
										)}
										collapsed={effectiveCollapsed}
										onClick={close}
									/>
								))}
							</div>
						)}
					</>
				)}

				{/* 7. Settings */}
				<TopNavItem
					icon={SettingsIcon}
					label="Settings"
					isActive={isSettings}
					expanded={openSection === "settings"}
					collapsed={effectiveCollapsed}
					onClick={() => {
						if (isSettings) {
							toggleSection("settings");
						} else {
							setOpenSection("settings");
							router.push(
								settingsItems[0]?.href ??
									"/app/settings/general",
							);
							close();
						}
					}}
				/>
				{openSection === "settings" && (
					<div className="space-y-0.5 pb-1">
						{settingsItems.map((item) => (
							<SubNavItem
								key={item.href}
								href={item.href}
								label={item.label}
								icon={item.icon}
								isActive={pathname.startsWith(item.href)}
								collapsed={effectiveCollapsed}
								onClick={close}
							/>
						))}
					</div>
				)}
			</nav>

			{/* Trial badge */}
			{!effectiveCollapsed && <TrialBanner onNavigate={close} />}

			{/* User row */}
			<div
				ref={userRowRef}
				className="relative px-3 pb-3 shrink-0 border-t border-(--sidebar-surface-border) pt-2"
			>
				{user && (
					<>
						{/* Expanded panel — shown above the trigger when open */}
						{openSection === "user" && (
							<div
								className={cn(
									"mb-2 rounded-2xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) overflow-hidden",
									effectiveCollapsed &&
										"absolute bottom-full left-2 z-50 w-64 shadow-lg",
								)}
							>
								{/* Avatar + greeting */}
								<div className="flex flex-col items-center pt-6 pb-4 px-4 gap-2">
									<UserAvatar
										name={user.name ?? ""}
										avatarUrl={user.image}
										className="size-16 text-xl mb-1"
									/>
									<p className="text-base font-bold text-(--sidebar-item-active-text)">
										👋 Hi, {user.name?.split(" ")[0]}
									</p>
									<p className="text-xs text-(--sidebar-text-muted)">
										{user.email}
									</p>
								</div>

								{/* Actions */}
								<div className="border-t border-(--sidebar-surface-border)">
									{!hideBilling && (
										<Link
											href="/app/settings/billing"
											onClick={close}
											className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text) transition-colors border-b border-(--sidebar-surface-border)"
										>
											<LayoutGridIcon className="size-4 text-(--sidebar-text-muted)" />
											Billing
										</Link>
									)}
									<div className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-(--sidebar-text) border-b border-(--sidebar-surface-border)">
										<span className="flex items-center gap-3">
											{theme === "dark" ? (
												<MoonIcon className="size-4 text-(--sidebar-text-muted)" />
											) : (
												<SunIcon className="size-4 text-(--sidebar-text-muted)" />
											)}
											Dark mode
										</span>
										<ThemeToggle />
									</div>
									<button
										type="button"
										onClick={onLogout}
										className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text) transition-colors"
									>
										<LogOutIcon className="size-4 text-(--sidebar-text-muted)" />
										Sign out
									</button>
								</div>
							</div>
						)}

						{/* Profile trigger row */}
						<button
							type="button"
							onClick={() =>
								setOpenSection((p) =>
									p === "user" ? null : "user",
								)
							}
							title={effectiveCollapsed ? user.name : undefined}
							className={cn(
								"w-full flex items-center gap-2 rounded-xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) px-3 py-2 hover:opacity-80 transition-colors",
								effectiveCollapsed &&
									"md:justify-center md:px-0",
							)}
						>
							<UserAvatar
								name={user.name ?? ""}
								avatarUrl={user.image}
								className="size-7 shrink-0 text-xs"
							/>
							{!effectiveCollapsed && (
								<div className="text-left min-w-0 flex-1">
									<p className="text-xs font-semibold text-(--sidebar-item-active-text) truncate">
										{user.name}
									</p>
									<p className="text-[10px] text-(--sidebar-text-muted) truncate">
										{user.email}
									</p>
								</div>
							)}
						</button>
					</>
				)}
			</div>
		</div>
	);

	return (
		<>
			{/* Mobile overlay */}
			{isMobileOpen && (
				<button
					type="button"
					aria-label="Close menu"
					className="fixed inset-0 z-30 bg-black/60 md:hidden cursor-default"
					onClick={() => setIsMobileOpen(false)}
				/>
			)}

			{/* Mobile top bar */}
			<header className="fixed top-0 left-0 right-0 z-50 h-14 bg-(--sidebar-bg) border-b border-(--sidebar-border) flex items-center px-4 gap-4 md:hidden">
				<button
					type="button"
					className="flex items-center justify-center w-8 h-8 rounded-lg text-(--sidebar-text-muted) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text) transition-colors shrink-0"
					aria-label="Open menu"
					onClick={() => setIsMobileOpen(!isMobileOpen)}
				>
					{isMobileOpen ? (
						<XIcon className="size-5" />
					) : (
						<MenuIcon className="size-5" />
					)}
				</button>
				<Link href="/app" className="flex items-center">
					<Logo withLabel={true} />
				</Link>
			</header>

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed top-0 left-0 bottom-0 z-40 flex flex-col bg-(--sidebar-bg) border-r border-(--sidebar-border) transition-[transform,width] duration-200",
					isCollapsed
						? "w-(--sidebar-width) md:w-(--sidebar-width-collapsed)"
						: "w-(--sidebar-width)",
					"md:translate-x-0",
					isMobileOpen
						? "translate-x-0 top-14"
						: "-translate-x-full md:translate-x-0",
				)}
			>
				{sidebarContent}
			</aside>
		</>
	);
}
