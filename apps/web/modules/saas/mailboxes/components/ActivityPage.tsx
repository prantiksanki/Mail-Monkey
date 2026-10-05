"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Card } from "@repo/ui/components/card";
import { Input } from "@repo/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/select";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import {
	AlertTriangleIcon,
	DownloadIcon,
	ExternalLinkIcon,
	MinusIcon,
	SearchIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useEffect, useMemo, useState } from "react";
import { getActionIcon } from "../lib/action-icons";
import {
	type ExecutionLogsFilters,
	useExecutionLogsQuery,
	useMailboxStatsQuery,
	useRulesQuery,
} from "../lib/rules-api";

const PAGE_SIZE = 30;
const MAX_PAGE_LIMIT = 100;

const STATUS_OPTIONS = ["all", "matched", "not_matched", "error"] as const;
type StatusOption = (typeof STATUS_OPTIONS)[number];

const RANGE_OPTIONS = ["1d", "7d", "30d", "all"] as const;
type RangeOption = (typeof RANGE_OPTIONS)[number];

interface ActionEntry {
	type?: string;
	success?: boolean;
	error?: string;
}

interface LogEntry {
	id: string;
	createdAt: string | Date;
	from: string | null;
	subject: string | null;
	status: "matched" | "not_matched" | "error";
	rule: { name: string } | null;
	actionsRun: unknown;
	messageId: string;
	error: string | null;
}

function parseFromDisplayName(raw: string | null | undefined): string {
	if (!raw) {
		return "";
	}
	const match = raw.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
	if (match) {
		return match[1].trim();
	}
	const emailOnly = raw.match(/^\s*<?([^<>\s]+@[^<>\s]+)>?\s*$/);
	if (emailOnly) {
		return emailOnly[1];
	}
	return raw.trim();
}

function rangeToSinceISO(range: RangeOption): string | undefined {
	if (range === "all") {
		return undefined;
	}
	const now = new Date();
	if (range === "1d") {
		now.setHours(0, 0, 0, 0);
		return now.toISOString();
	}
	const days = range === "7d" ? 7 : 30;
	now.setDate(now.getDate() - days);
	return now.toISOString();
}

function gmailUrl(email: string, messageId: string) {
	return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#inbox/${messageId}`;
}

function escapeCsvField(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}
	const str = String(value);
	// Neutralize spreadsheet formula injection: cells starting with =, +, -, @,
	// tab, or CR are interpreted as formulas by Excel/Sheets/LibreOffice.
	const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
	if (/[",\r\n]/.test(safe)) {
		return `"${safe.replace(/"/g, '""')}"`;
	}
	return safe;
}

function logsToCsv(logs: LogEntry[]): string {
	const headers = [
		"Time",
		"From",
		"Subject",
		"Rule",
		"Status",
		"Actions",
		"Message ID",
		"Error",
	];
	const rows = logs.map((log) => {
		const actions = Array.isArray(log.actionsRun)
			? (log.actionsRun as ActionEntry[])
					.map((a) => a?.type)
					.filter((t): t is string => Boolean(t))
					.join("; ")
			: "";
		return [
			new Date(log.createdAt).toISOString(),
			log.from ?? "",
			log.subject ?? "",
			log.rule?.name ?? "",
			log.status,
			actions,
			log.messageId,
			log.error ?? "",
		]
			.map(escapeCsvField)
			.join(",");
	});
	return [headers.join(","), ...rows].join("\r\n");
}

function downloadCsv(filename: string, content: string) {
	const blob = new Blob(["﻿", content], {
		type: "text/csv;charset=utf-8;",
	});
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

function isToday(d: Date, now: Date) {
	return (
		d.getFullYear() === now.getFullYear() &&
		d.getMonth() === now.getMonth() &&
		d.getDate() === now.getDate()
	);
}

function isYesterday(d: Date, now: Date) {
	const yesterday = new Date(now);
	yesterday.setDate(now.getDate() - 1);
	return (
		d.getFullYear() === yesterday.getFullYear() &&
		d.getMonth() === yesterday.getMonth() &&
		d.getDate() === yesterday.getDate()
	);
}

export function ActivityPage() {
	const t = useTranslations();
	const format = useFormatter();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: mailboxes = [] } = useMailboxesQuery();
	const { data: rulesData } = useRulesQuery(selectedMailboxId);
	const { data: stats } = useMailboxStatsQuery(selectedMailboxId);

	const [ruleFilter, setRuleFilter] = useQueryState(
		"rule",
		parseAsString.withDefault("all"),
	);
	const [statusFilter, setStatusFilter] = useQueryState(
		"status",
		parseAsString.withDefault("matched"),
	);
	const [rangeFilter, setRangeFilter] = useQueryState(
		"range",
		parseAsString.withDefault("7d"),
	);
	const [searchFilter, setSearchFilter] = useQueryState(
		"q",
		parseAsString.withDefault(""),
	);

	const [searchInput, setSearchInput] = useState(searchFilter);
	const [pageLimit, setPageLimit] = useState(PAGE_SIZE);

	useEffect(() => {
		const handle = setTimeout(() => {
			setSearchFilter(searchInput || null);
		}, 300);
		return () => clearTimeout(handle);
	}, [searchInput, setSearchFilter]);

	useEffect(() => {
		setPageLimit(PAGE_SIZE);
	}, [ruleFilter, statusFilter, rangeFilter, searchFilter]);

	const status = (
		STATUS_OPTIONS.includes(statusFilter as StatusOption)
			? statusFilter
			: "all"
	) as StatusOption;
	const range = (
		RANGE_OPTIONS.includes(rangeFilter as RangeOption) ? rangeFilter : "7d"
	) as RangeOption;

	const filters: ExecutionLogsFilters = useMemo(
		() => ({
			...(ruleFilter !== "all" ? { ruleId: ruleFilter } : {}),
			...(status !== "all"
				? { status: status as "matched" | "not_matched" | "error" }
				: {}),
			...(range !== "all" ? { since: rangeToSinceISO(range) } : {}),
			...(searchFilter ? { search: searchFilter } : {}),
		}),
		[ruleFilter, status, range, searchFilter],
	);

	const { data, isLoading } = useExecutionLogsQuery(
		selectedMailboxId,
		pageLimit,
		0,
		filters,
	);

	const [drawerLog, setDrawerLog] = useState<LogEntry | null>(null);

	const selectedMailbox = mailboxes.find((m) => m.id === selectedMailboxId);
	const rules = rulesData?.rules ?? [];
	const logs = (data?.logs ?? []) as unknown as LogEntry[];
	const total = data?.total ?? 0;
	const canLoadMore = pageLimit < total && pageLimit < MAX_PAGE_LIMIT;

	const groupedByDay = useMemo(() => {
		const now = new Date();
		const groups = new Map<
			string,
			{ label: string; date: Date; logs: LogEntry[] }
		>();
		for (const log of logs) {
			const d = new Date(log.createdAt);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
			const label = isToday(d, now)
				? t("activity.day.today")
				: isYesterday(d, now)
					? t("activity.day.yesterday")
					: format.dateTime(d, { month: "short", day: "numeric" });
			if (!groups.has(key)) {
				groups.set(key, { label, date: d, logs: [] });
			}
			groups.get(key)?.logs.push(log);
		}
		return Array.from(groups.values()).sort(
			(a, b) => b.date.getTime() - a.date.getTime(),
		);
	}, [logs, t, format]);

	const weekEvaluations = stats?.processed7d ?? 0;
	const weekFired = stats?.fired7d ?? 0;
	const topRules = stats?.topRules7d ?? [];
	const maxRuleCount = topRules[0]?.count ?? 0;

	if (!selectedMailboxId || !selectedMailbox) {
		return (
			<Card className="p-12">
				<div className="text-center">
					<p className="text-muted-foreground">
						{t("rules.noMailboxSelected")}
					</p>
				</div>
			</Card>
		);
	}

	const filtersActive =
		ruleFilter !== "all" ||
		status !== "all" ||
		range !== "7d" ||
		!!searchFilter;

	return (
		<div className="space-y-8">
			<PageHeader />

			<FilterBar
				ruleFilter={ruleFilter}
				status={status}
				range={range}
				searchInput={searchInput}
				onRuleChange={setRuleFilter}
				onStatusChange={setStatusFilter}
				onRangeChange={setRangeFilter}
				onSearchInputChange={setSearchInput}
				rules={rules.map((r) => ({ id: r.id, name: r.name }))}
			/>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
				<div className="min-w-0">
					<Card className="overflow-hidden bg-card p-0 shadow-none">
						{isLoading ? (
							<div className="space-y-3 p-5">
								<Skeleton className="h-14 w-full" />
								<Skeleton className="h-14 w-full" />
								<Skeleton className="h-14 w-full" />
								<Skeleton className="h-14 w-full" />
							</div>
						) : groupedByDay.length === 0 ? (
							<div className="px-5 py-16 text-center">
								<p className="text-foreground text-sm">
									{filtersActive
										? t("activity.empty.filtered")
										: t("activity.empty.firstRun")}
								</p>
							</div>
						) : (
							<>
								<div className="divide-y divide-border">
									{groupedByDay.map((group) => (
										<LogDayGroup
											key={
												group.label +
												group.date.toDateString()
											}
											label={group.label}
											date={group.date}
											logs={group.logs}
											onOpenLog={(log) =>
												setDrawerLog(log)
											}
										/>
									))}
								</div>

								{canLoadMore && (
									<div className="flex justify-center border-border border-t px-5 py-3">
										<Button
											variant="secondary"
											size="sm"
											onClick={() =>
												setPageLimit((l) =>
													Math.min(
														l + PAGE_SIZE,
														MAX_PAGE_LIMIT,
													),
												)
											}
										>
											{t("activity.loadMore")}
										</Button>
									</div>
								)}
							</>
						)}
					</Card>
				</div>

				<ActivitySidebar
					weekEvaluations={weekEvaluations}
					weekFired={weekFired}
					topRules={topRules}
					maxRuleCount={maxRuleCount}
					canExport={logs.length > 0}
					onExport={() => {
						if (logs.length === 0) {
							return;
						}
						const csv = logsToCsv(logs);
						const dateStr = new Date().toISOString().slice(0, 10);
						const safeEmail = selectedMailbox.email.replace(
							/[^a-zA-Z0-9._-]/g,
							"_",
						);
						downloadCsv(
							`zeromail-activity-${safeEmail}-${dateStr}.csv`,
							csv,
						);
					}}
				/>
			</div>

			<ActivityDrawer
				log={drawerLog}
				mailboxEmail={selectedMailbox.email}
				onOpenChange={(open) => {
					if (!open) {
						setDrawerLog(null);
					}
				}}
			/>
		</div>
	);
}

function PageHeader() {
	const t = useTranslations();
	return (
		<div className="border-border border-b pb-8">
			<p className="font-mono text-foreground text-[11px] uppercase tracking-[0.18em]">
				{t("activity.eyebrow")}
			</p>
			<h1 className="mt-3 text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
				{t("activity.title")}
			</h1>
			<p className="mt-3 max-w-2xl text-foreground text-sm leading-relaxed">
				{t("activity.subtitle")}
			</p>
		</div>
	);
}

interface FilterBarProps {
	ruleFilter: string;
	status: StatusOption;
	range: RangeOption;
	searchInput: string;
	onRuleChange: (value: string) => void;
	onStatusChange: (value: StatusOption) => void;
	onRangeChange: (value: RangeOption) => void;
	onSearchInputChange: (value: string) => void;
	rules: Array<{ id: string; name: string }>;
}

function FilterBar({
	ruleFilter,
	status,
	range,
	searchInput,
	onRuleChange,
	onStatusChange,
	onRangeChange,
	onSearchInputChange,
	rules,
}: FilterBarProps) {
	const t = useTranslations();
	return (
		<div className="flex flex-wrap items-center gap-2">
			<Select value={ruleFilter} onValueChange={onRuleChange}>
				<SelectTrigger className="h-9 w-auto min-w-[140px] rounded-md border-border bg-card text-sm shadow-none">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">
						{t("activity.filters.rule.all")}
					</SelectItem>
					{rules.map((rule) => (
						<SelectItem key={rule.id} value={rule.id}>
							{rule.name}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Select
				value={status}
				onValueChange={(v) => onStatusChange(v as StatusOption)}
			>
				<SelectTrigger className="h-9 w-auto min-w-[140px] rounded-md border-border bg-card text-sm shadow-none">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">
						{t("activity.filters.status.all")}
					</SelectItem>
					<SelectItem value="matched">
						{t("activity.filters.status.matched")}
					</SelectItem>
					<SelectItem value="not_matched">
						{t("activity.filters.status.notMatched")}
					</SelectItem>
					<SelectItem value="error">
						{t("activity.filters.status.error")}
					</SelectItem>
				</SelectContent>
			</Select>

			<Select
				value={range}
				onValueChange={(v) => onRangeChange(v as RangeOption)}
			>
				<SelectTrigger className="h-9 w-auto min-w-[140px] rounded-md border-border bg-card text-sm shadow-none">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="1d">
						{t("activity.filters.range.1d")}
					</SelectItem>
					<SelectItem value="7d">
						{t("activity.filters.range.7d")}
					</SelectItem>
					<SelectItem value="30d">
						{t("activity.filters.range.30d")}
					</SelectItem>
					<SelectItem value="all">
						{t("activity.filters.range.all")}
					</SelectItem>
				</SelectContent>
			</Select>

			<div className="relative ml-auto w-full sm:w-[280px]">
				<SearchIcon className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-foreground" />
				<Input
					value={searchInput}
					onChange={(e) => onSearchInputChange(e.target.value)}
					placeholder={t("activity.filters.search")}
					className="h-9 rounded-md border-border bg-card pl-9 text-sm shadow-none"
				/>
			</div>
		</div>
	);
}

interface LogDayGroupProps {
	label: string;
	date: Date;
	logs: LogEntry[];
	onOpenLog: (log: LogEntry) => void;
}

function LogDayGroup({ label, date, logs, onOpenLog }: LogDayGroupProps) {
	const t = useTranslations();
	const format = useFormatter();
	const actionCount = logs.filter((l) => l.status === "matched").length;
	return (
		<section className="px-2 py-2 sm:px-4">
			<header className="flex items-center justify-between px-3 pt-3 pb-2 font-mono text-foreground text-[11px] uppercase tracking-[0.16em]">
				<span>
					{label} ·{" "}
					{format.dateTime(date, { month: "short", day: "numeric" })}
				</span>
				<span>
					{t("activity.day.actionCount", { count: actionCount })}
				</span>
			</header>
			<div className="divide-y divide-border/60">
				{logs.map((log) => (
					<LogRow key={log.id} log={log} onOpenLog={onOpenLog} />
				))}
			</div>
		</section>
	);
}

interface LogRowProps {
	log: LogEntry;
	onOpenLog: (log: LogEntry) => void;
}

function LogRow({ log, onOpenLog }: LogRowProps) {
	const t = useTranslations();
	const format = useFormatter();

	const actions = Array.isArray(log.actionsRun)
		? (log.actionsRun as ActionEntry[])
		: [];
	const primaryAction = actions.find((a) => a?.type && a.success !== false);
	const extraCount = actions.filter(
		(a) => a?.type && a.success !== false,
	).length;
	const fromName = parseFromDisplayName(log.from);
	const time = format.dateTime(new Date(log.createdAt), {
		hour: "2-digit",
		minute: "2-digit",
	});

	const isSkip = log.status === "not_matched";
	const isError = log.status === "error";

	const Icon = isError
		? AlertTriangleIcon
		: isSkip
			? MinusIcon
			: getActionIcon(primaryAction?.type);

	const actionLabel = isError
		? t("activity.filters.status.error")
		: isSkip
			? t("activity.row.noMatch")
			: primaryAction?.type
				? t(`rules.ruleForm.actionTypes.${primaryAction.type}`)
				: t("activity.row.noMatch");

	const ruleLabel = log.rule?.name ?? "—";

	return (
		<button
			type="button"
			onClick={() => onOpenLog(log)}
			className="group grid w-full cursor-pointer grid-cols-[56px_28px_1fr_auto] items-start gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/50"
		>
			<span className="pt-0.5 font-mono text-foreground text-xs">
				{time}
			</span>
			<span
				className={`flex size-6 shrink-0 items-center justify-center rounded-md ${
					isError
						? "bg-destructive/10 text-destructive"
						: isSkip
							? "bg-muted text-foreground"
							: "bg-primary/10 text-primary"
				}`}
			>
				<Icon className="size-3.5" />
			</span>
			<div className="min-w-0">
				<p className="truncate font-medium text-foreground text-sm">
					{log.subject || fromName || "—"}
				</p>
				{log.subject && fromName && (
					<p className="mt-0.5 truncate text-foreground text-xs">
						{fromName}
					</p>
				)}
			</div>
			<div className="text-right font-mono text-xs">
				<div
					className={
						isSkip || isError ? "text-foreground" : "text-primary"
					}
				>
					{actionLabel}
					{!isSkip && !isError && extraCount > 1 && (
						<span className="text-foreground">
							{" "}
							+{extraCount - 1}
						</span>
					)}
				</div>
				<div className="mt-0.5 text-foreground">
					{isSkip
						? t("activity.row.rulesEvaluated", {
								count: extraCount,
							})
						: ruleLabel}
				</div>
			</div>
		</button>
	);
}

interface ActivitySidebarProps {
	weekEvaluations: number;
	weekFired: number;
	topRules: Array<{ id: string; name: string; count: number }>;
	maxRuleCount: number;
	canExport: boolean;
	onExport: () => void;
}

function ActivitySidebar({
	weekEvaluations,
	weekFired,
	topRules,
	maxRuleCount,
	canExport,
	onExport,
}: ActivitySidebarProps) {
	const t = useTranslations();
	const format = useFormatter();
	return (
		<aside className="space-y-4">
			<Card className="bg-card p-5 shadow-none">
				<p className="font-mono text-foreground text-[11px] uppercase tracking-[0.16em]">
					{t("activity.sidebar.thisWeek")}
				</p>
				<p className="mt-3 font-serif font-normal text-4xl leading-none tracking-tight">
					{format.number(weekEvaluations)}
				</p>
				<p className="mt-2 text-foreground text-xs">
					{t("activity.sidebar.evaluations", {
						count: format.number(weekEvaluations),
						actions: format.number(weekFired),
					})}
				</p>
			</Card>

			<Card className="overflow-hidden bg-card p-0 shadow-none">
				<div className="flex items-center justify-between border-border border-b px-5 py-3">
					<span className="font-medium text-foreground text-sm">
						{t("activity.sidebar.ruleHeat")}
					</span>
					<span className="font-mono text-foreground text-[11px] uppercase tracking-[0.14em]">
						{t("activity.sidebar.range7d")}
					</span>
				</div>
				<div className="space-y-3.5 px-5 py-4">
					{topRules.length === 0 ? (
						<p className="text-foreground text-xs">
							{t("activity.empty.firstRun")}
						</p>
					) : (
						topRules.map((rule) => {
							const pct =
								maxRuleCount > 0
									? Math.max(
											4,
											Math.round(
												(rule.count / maxRuleCount) *
													100,
											),
										)
									: 0;
							return (
								<div key={rule.id} className="text-xs">
									<div className="flex items-center justify-between">
										<span className="truncate pr-2 text-foreground">
											{rule.name}
										</span>
										<span className="font-mono text-foreground">
											{rule.count}
										</span>
									</div>
									<div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-primary"
											style={{ width: `${pct}%` }}
										/>
									</div>
								</div>
							);
						})
					)}
				</div>
			</Card>

			<Button
				type="button"
				variant="secondary"
				className="w-full justify-center"
				onClick={onExport}
				disabled={!canExport}
			>
				<DownloadIcon className="mr-2 size-4" />
				Export current view
			</Button>
		</aside>
	);
}

interface ActivityDrawerProps {
	log: LogEntry | null;
	mailboxEmail: string;
	onOpenChange: (open: boolean) => void;
}

function ActivityDrawer({
	log,
	mailboxEmail,
	onOpenChange,
}: ActivityDrawerProps) {
	const t = useTranslations();
	const format = useFormatter();

	if (!log) {
		return (
			<Sheet open={false} onOpenChange={onOpenChange}>
				<SheetContent side="right" className="w-full sm:max-w-md" />
			</Sheet>
		);
	}

	const actions = Array.isArray(log.actionsRun)
		? (log.actionsRun as ActionEntry[])
		: [];
	const isSkip = log.status === "not_matched";
	const isError = log.status === "error";
	const fromName = parseFromDisplayName(log.from);
	const when = format.dateTime(new Date(log.createdAt), {
		dateStyle: "medium",
		timeStyle: "short",
	});

	const seedParams = new URLSearchParams();
	if (log.subject) {
		seedParams.set("seed", log.subject);
	}
	if (fromName) {
		seedParams.set("from", fromName);
	}
	const assistantHref = seedParams.toString()
		? `/app/rules/assistant?${seedParams.toString()}`
		: "/app/rules/assistant";

	return (
		<Sheet open={!!log} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 sm:max-w-md"
			>
				<SheetHeader className="px-6 pt-6 pb-4">
					<span className="font-mono text-foreground text-xs uppercase tracking-wider">
						{when}
					</span>
					<SheetTitle className="pr-8 font-serif font-normal text-xl leading-tight tracking-tight">
						{log.subject || fromName || "—"}
					</SheetTitle>
				</SheetHeader>

				<div className="flex-1 overflow-y-auto px-6 pb-6">
					<dl className="grid grid-cols-[80px_1fr] gap-x-4 gap-y-2.5 text-sm">
						<dt className="font-mono text-foreground text-[10px] uppercase tracking-wider">
							{t("activity.drawer.from")}
						</dt>
						<dd className="break-words">{log.from ?? "—"}</dd>

						<dt className="font-mono text-foreground text-[10px] uppercase tracking-wider">
							{t("activity.drawer.rule")}
						</dt>
						<dd>{log.rule?.name ?? "—"}</dd>

						<dt className="font-mono text-foreground text-[10px] uppercase tracking-wider">
							{t("activity.drawer.status")}
						</dt>
						<dd>
							<Badge
								status={
									log.status === "matched"
										? "success"
										: log.status === "error"
											? "error"
											: "info"
								}
							>
								{t(`rules.executionLog.status.${log.status}`)}
							</Badge>
						</dd>
					</dl>

					{actions.length > 0 && (
						<div className="mt-5">
							<p className="mb-2 font-mono text-foreground text-[10px] uppercase tracking-wider">
								{t("activity.drawer.action")}
							</p>
							<div className="space-y-1.5">
								{actions.map((action, i) => {
									const ActionIcon = getActionIcon(
										action?.type,
									);
									return (
										<div
											key={`${action?.type ?? "action"}-${i}`}
											className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm"
										>
											<ActionIcon className="size-4 shrink-0 text-foreground" />
											<span className="flex-1">
												{action?.type
													? t(
															`rules.ruleForm.actionTypes.${action.type}`,
														)
													: "—"}
											</span>
											{action?.success === false && (
												<span className="font-mono text-destructive text-xs">
													{t(
														"activity.drawer.actionFailed",
													)}
												</span>
											)}
										</div>
									);
								})}
							</div>
						</div>
					)}

					{log.error && (
						<div className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive text-sm">
							<p className="mb-1 font-mono text-[10px] uppercase tracking-wider">
								{t("activity.drawer.error")}
							</p>
							<p>{log.error}</p>
						</div>
					)}

					{mailboxEmail && log.messageId && (
						<div className="mt-5">
							<a
								href={gmailUrl(mailboxEmail, log.messageId)}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 font-mono text-foreground text-xs hover:text-foreground"
							>
								<span className="truncate">
									{log.messageId}
								</span>
								<ExternalLinkIcon className="size-3" />
							</a>
						</div>
					)}
				</div>

				{(isSkip || isError) && (
					<div className="border-border border-t px-6 py-4">
						<Button asChild variant="primary" className="w-full">
							<Link href={assistantHref}>
								<SparklesIcon className="mr-2 size-4" />
								{t("activity.drawer.buildRule")}
							</Link>
						</Button>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
