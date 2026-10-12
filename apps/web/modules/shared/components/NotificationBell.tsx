"use client";

import { cn } from "@repo/ui";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Sidebar notification bell — shows all of the user's unread Notification
 * rows (reminders, trial-ended, and any future type), not just one hardcoded
 * type like TrialEndedBanner does. Polls every 30s so a fired reminder
 * surfaces without a page reload. The dropdown is `fixed`-positioned from the
 * bell's own bounding rect (clamped to the viewport) rather than CSS
 * left/right-anchored, since the sidebar is narrower than the panel and an
 * anchored position pushed it off-screen.
 *
 * Renders as its own nav row (same treatment as Dashboard/Mail/Calendar)
 * rather than a header icon, so it collapses to a centered icon like every
 * other row instead of disappearing.
 */
export function NotificationBell({ collapsed }: { collapsed?: boolean }) {
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});
	const containerRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();
	const router = useRouter();

	const { data } = useQuery({
		...orpc.notifications.listNotifications.queryOptions({ input: {} }),
		refetchInterval: 30_000,
	});

	const markReadMutation = useMutation(
		orpc.notifications.markRead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries({
					queryKey: orpc.notifications.listNotifications.key(),
				});
			},
		}),
	);

	useEffect(() => {
		if (!open) {
			return;
		}
		const onClickAway = (e: MouseEvent) => {
			if (!containerRef.current?.contains(e.target as Node)) {
				setOpen(false);
			}
		};
		document.addEventListener("mousedown", onClickAway);
		return () => document.removeEventListener("mousedown", onClickAway);
	}, [open]);

	useEffect(() => {
		if (!open || !containerRef.current) {
			return;
		}
		const PANEL_WIDTH = 320;
		const MARGIN = 16;
		const updatePosition = () => {
			const rect = containerRef.current?.getBoundingClientRect();
			if (!rect) {
				return;
			}
			setPosition({
				top: rect.bottom + 4,
				left: Math.min(
					rect.left,
					window.innerWidth - PANEL_WIDTH - MARGIN,
				),
			});
		};
		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [open]);

	const notifications = data?.notifications ?? [];
	const hasUnread = notifications.length > 0;

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((p) => !p)}
				aria-label="Notifications"
				title={collapsed ? "Notifications" : undefined}
				className={cn(
					"relative w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors text-(--sidebar-text) hover:bg-(--sidebar-item-hover-bg) hover:text-(--sidebar-item-active-text)",
					collapsed && "justify-center px-0 py-3",
				)}
			>
				<BellIcon
					className={cn(
						"shrink-0 text-(--sidebar-text-muted)",
						collapsed ? "size-5" : "size-4",
					)}
				/>
				{collapsed ? (
					hasUnread && (
						<span className="absolute top-1.5 right-2.5 size-2 rounded-full bg-(--sidebar-badge-bg) ring-2 ring-(--sidebar-bg)" />
					)
				) : (
					<>
						<span className="flex-1 text-left">Notifications</span>
						{hasUnread && (
							<span className="size-2 rounded-full bg-(--sidebar-badge-bg) shrink-0" />
						)}
					</>
				)}
			</button>

			{open && (
				<div
					className="fixed z-50 w-80 max-w-[calc(100vw-2rem)] max-h-96 overflow-y-auto rounded-2xl border border-(--sidebar-surface-border) bg-(--sidebar-surface) shadow-lg"
					style={{ top: position.top, left: position.left }}
				>
					<div className="px-4 py-3 border-b border-(--sidebar-surface-border) text-xs font-semibold uppercase tracking-wide text-(--sidebar-section-label)">
						Notifications
					</div>
					{notifications.length === 0 ? (
						<p className="px-4 py-6 text-center text-sm text-(--sidebar-text-muted)">
							You're all caught up.
						</p>
					) : (
						<ul>
							{notifications.map((n) => (
								<li
									key={n.id}
									className="border-b border-(--sidebar-surface-border) last:border-b-0"
								>
									<button
										type="button"
										onClick={() => {
											markReadMutation.mutate({
												id: n.id,
											});
											setOpen(false);
											if (n.emailId) {
												router.push(
													`/app/mailboxes?folder=inbox&message=${encodeURIComponent(n.emailId)}`,
												);
											}
										}}
										className="w-full px-4 py-3 text-left hover:bg-(--sidebar-item-hover-bg) transition-colors"
									>
										<p className="text-sm font-medium text-(--sidebar-item-active-text)">
											{n.title}
										</p>
										<p className="mt-0.5 text-xs text-(--sidebar-text-muted)">
											{n.body}
										</p>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
