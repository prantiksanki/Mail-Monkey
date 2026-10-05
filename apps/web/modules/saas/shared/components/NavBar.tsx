"use client";

import { authClient } from "@repo/auth/client";
import { cn, Logo } from "@repo/ui";
import { useSession } from "@saas/auth/hooks/use-session";
import { useRulesQuery } from "@saas/mailboxes/lib/rules-api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { useActiveOrganization } from "@saas/organizations/hooks/use-active-organization";
import { UserAvatar } from "@shared/components/UserAvatar";
import {
	AlarmClockIcon,
	CalendarClockIcon,
	CalendarDaysIcon,
	InboxIcon,
	LayoutDashboardIcon,
	LayoutGridIcon,
	ListFilterIcon,
	LogOutIcon,
	MailIcon,
	MailsIcon,
	MenuIcon,
	MoonIcon,
	PencilIcon,
	PlusIcon,
	SendIcon,
	SettingsIcon,
	SparklesIcon,
	SunIcon,
	Trash2Icon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useState } from "react";
import { config as webConfig } from "@/config";
import { useSidebar } from "../lib/sidebar-context";

const LABEL_COLORS = [
	"#F28B82",
	"#FBBC04",
	"#34A853",
	"#4285F4",
	"#AB47BC",
	"#FF7043",
	"#26A69A",
	"#EC407A",
	"#8E24AA",
	"#00897B",
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
}: {
	icon: React.ElementType;
	label: string;
	isActive: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
				isActive
					? "bg-(--sidebar-item-active-bg) text-(--sidebar-item-active-text)"
					: "text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text)",
			)}
		>
			<Icon
				className={cn(
					"size-4 shrink-0",
					isActive
						? "text-(--sidebar-item-active-icon)"
						: "text-(--sidebar-text-muted)",
				)}
			/>
			<span className="flex-1 text-left">{label}</span>
		</button>
	);
}

function SubNavItem({
	href,
	label,
	isActive,
	onClick,
	dot,
	dotColor,
}: {
	href: string;
	label: string;
	isActive: boolean;
	onClick?: () => void;
	dot?: boolean;
	dotColor?: string;
}) {
	return (
		<Link
			href={href}
			prefetch
			onClick={onClick}
			className={cn(
				"flex items-center gap-2.5 rounded-md ml-7 pl-3 pr-3 py-1.5 text-[13px] font-medium transition-colors",
				isActive
					? "bg-(--sidebar-item-active-bg) text-(--sidebar-item-active-text)"
					: "text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text)",
			)}
		>
			{dot && dotColor && (
				<span
					className="size-2 rounded-full shrink-0 bg-(--dot-color)"
					style={{ "--dot-color": dotColor } as React.CSSProperties}
				/>
			)}
			<span className="truncate">{label}</span>
		</Link>
	);
}

export function NavBar() {
	const t = useTranslations();
	const pathname = usePathname();
	const { user } = useSession();
	const { activeOrganization, isOrganizationAdmin } = useActiveOrganization();
	const { isMobileOpen, setIsMobileOpen } = useSidebar();
	const searchParams = useSearchParams();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: rulesData } = useRulesQuery(selectedMailboxId);
	const { theme, setTheme } = useTheme();

	// Which top-level section is expanded
	const [openSection, setOpenSection] = useState<string | null>(() => {
		if (pathname.startsWith("/app/mailboxes")) {
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
				return {
					id: rule.id,
					name: labelName,
					color: labelColor(labelName),
				};
			});
		// One chip per label name (case-insensitive) — guards against legacy
		// data where multiple rules created the same label.
		const seen = new Set<string>();
		return all.filter((label) => {
			const key = label.name.trim().toLowerCase();
			if (seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	})();

	const { useSidebarLayout } = webConfig.saas;

	const basePath = activeOrganization
		? `/app/${activeOrganization.slug}`
		: "/app";

	const onLogout = () => {
		authClient.signOut({
			fetchOptions: {
				onSuccess: async () => {
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
	const isCalendar = pathname.startsWith("/app/calendar");
	const isRules =
		pathname.startsWith("/app/rules") &&
		!pathname.startsWith("/app/rules/assistant");
	const isActivity = pathname.startsWith("/app/activity");
	const isAI = pathname.startsWith("/app/rules/assistant");
	const isSettings =
		pathname.startsWith("/app/settings") ||
		pathname.startsWith("/app/admin");

	const currentFolder = searchParams.get("folder") ?? "inbox";
	const currentLabel = searchParams.get("label");

	const settingsItems = [
		{
			label: "General",
			href: "/app/settings/general",
		},
		...(activeOrganization && isOrganizationAdmin
			? [
					{
						label: "Organization",
						href: `${basePath}/settings`,
					},
				]
			: []),
		{
			label: "Security",
			href: "/app/settings/security",
		},
		{
			label: "Billing",
			href: "/app/settings/billing",
		},
		{
			label: "Danger Zone",
			href: "/app/settings/danger-zone",
		},
		...(user?.role === "admin"
			? [
					{
						label: "Admin",
						href: "/app/admin",
					},
				]
			: []),
	];

	const sidebarContent = (
		<div className="flex flex-col h-full">
			{/* Logo */}
			<div className="px-4 py-4 shrink-0">
				<Link href="/app" className="flex items-center" onClick={close}>
					<Logo withLabel={true} />
				</Link>
			</div>

			{/* Nav items */}
			<nav className="flex-1 overflow-y-auto no-scrollbar px-2 pb-4 space-y-0.5">
				{/* 1. Dashboard */}
				<TopNavItem
					icon={LayoutDashboardIcon}
					label={t("app.menu.dashboard")}
					isActive={isDashboard}
					onClick={() => {
						window.location.href = basePath;
						close();
					}}
				/>

				{/* 2. Mail */}
				<TopNavItem
					icon={MailIcon}
					label="Mail"
					isActive={isMail}
					onClick={() => toggleSection("mail")}
				/>
				{openSection === "mail" && (
					<div className="space-y-0.5 pb-1">
						<Link
							href="/app/mailboxes?folder=inbox&compose=true"
							onClick={close}
							className="flex items-center gap-2 ml-7 mr-2 my-1 px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-[13px] font-semibold transition-colors"
						>
							<PencilIcon className="size-3.5" />
							Compose
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

						{/* Labels sub-section */}
						{labelRules.length > 0 && (
							<>
								<div className="flex items-center justify-between ml-7 pr-2 mt-3 mb-1">
									<span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-(--sidebar-section-label)">
										Labels
									</span>
									<Link
										href="/app/rules"
										onClick={close}
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
										isActive={
											isMail &&
											currentLabel === label.name
										}
										onClick={close}
										dot
										dotColor={label.color}
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
					onClick={() => {
						window.location.href = "/app/calendar";
						close();
					}}
				/>

				{/* 4. Rules */}
				<TopNavItem
					icon={ListFilterIcon}
					label={t("app.menu.rules")}
					isActive={isRules || isActivity}
					onClick={() => toggleSection("rules")}
				/>
				{openSection === "rules" && (
					<div className="space-y-0.5 pb-1">
						<SubNavItem
							href="/app/rules"
							label="All Rules"
							isActive={isRules}
							onClick={close}
						/>
						<SubNavItem
							href="/app/activity"
							label={t("app.menu.activity")}
							isActive={isActivity}
							onClick={close}
						/>
					</div>
				)}

				{/* 5. AI Assistant */}
				<TopNavItem
					icon={SparklesIcon}
					label={t("app.menu.aiAssistant")}
					isActive={isAI}
					onClick={() => {
						window.location.href = "/app/rules/assistant";
						close();
					}}
				/>

				{/* 6. Settings */}
				<TopNavItem
					icon={SettingsIcon}
					label="Settings"
					isActive={isSettings}
					onClick={() => toggleSection("settings")}
				/>
				{openSection === "settings" && (
					<div className="space-y-0.5 pb-1">
						{settingsItems.map((item) => (
							<SubNavItem
								key={item.href}
								href={item.href}
								label={item.label}
								isActive={pathname.startsWith(item.href)}
								onClick={close}
							/>
						))}
					</div>
				)}
			</nav>

			{/* Trial badge */}
			<div className="px-3 pb-2 shrink-0">
				<Link
					href="/app/settings/billing"
					onClick={close}
					className="flex items-center justify-between gap-2 rounded-xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) px-3 py-2.5 hover:opacity-80 transition-colors group"
				>
					<div className="flex items-center gap-2">
						<ZapIcon className="size-3.5 text-primary shrink-0" />
						<span className="text-(--sidebar-text) text-xs">
							7 days left of free trial
						</span>
					</div>
					<span className="text-(--sidebar-section-label) text-xs">
						›
					</span>
				</Link>
			</div>

			{/* User row */}
			<div className="px-3 pb-3 shrink-0 border-t border-(--sidebar-surface-border) pt-2">
				{user && (
					<>
						{/* Expanded panel — shown above the trigger when open */}
						{openSection === "user" && (
							<div className="mb-2 rounded-2xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) overflow-hidden">
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
									<Link
										href="/app/settings/billing"
										onClick={close}
										className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text) transition-colors border-b border-(--sidebar-surface-border)"
									>
										<LayoutGridIcon className="size-4 text-(--sidebar-text-muted)" />
										Billing
									</Link>
									<button
										type="button"
										onClick={() =>
											setTheme(
												theme === "dark"
													? "light"
													: "dark",
											)
										}
										className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text) transition-colors border-b border-(--sidebar-surface-border)"
									>
										{theme === "dark" ? (
											<SunIcon className="size-4 text-(--sidebar-text-muted)" />
										) : (
											<MoonIcon className="size-4 text-(--sidebar-text-muted)" />
										)}
										{theme === "dark"
											? "Light mode"
											: "Dark mode"}
									</button>
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
							className="w-full flex items-center gap-2 rounded-xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) px-3 py-2 hover:opacity-80 transition-colors"
						>
							<UserAvatar
								name={user.name ?? ""}
								avatarUrl={user.image}
								className="size-7 shrink-0 text-xs"
							/>
							<div className="text-left min-w-0 flex-1">
								<p className="text-xs font-semibold text-(--sidebar-item-active-text) truncate">
									{user.name}
								</p>
								<p className="text-[10px] text-(--sidebar-text-muted) truncate">
									{user.email}
								</p>
							</div>
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
					"fixed top-0 left-0 bottom-0 z-40 w-(--sidebar-width) flex flex-col bg-(--sidebar-bg) border-r border-(--sidebar-border) transition-transform duration-200",
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
