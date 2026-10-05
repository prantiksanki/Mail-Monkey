"use client";
import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@repo/ui/components/tooltip";
import { useSession } from "@saas/auth/hooks/use-session";
import { UserAvatar } from "@shared/components/UserAvatar";
import { useQueryClient } from "@tanstack/react-query";
import {
	AlertCircleIcon,
	ChevronDownIcon,
	PlusIcon,
	UnlinkIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AddMailboxDialog } from "@/modules/saas/mailboxes/components/AddMailboxDialog";
import { DisconnectMailboxDialog } from "@/modules/saas/mailboxes/components/DisconnectMailboxDialog";
import { mailboxesQueryKey, useMailboxesQuery } from "../lib/api";
import { useSelectedMailbox } from "../lib/selected-mailbox-context";

export function MailboxSelect({
	className,
	collapsed = false,
}: {
	className?: string;
	collapsed?: boolean;
}) {
	const t = useTranslations();
	const { user } = useSession();
	const queryClient = useQueryClient();
	const { data: mailboxes = [], isLoading, error } = useMailboxesQuery();
	const { selectedMailboxId, setSelectedMailboxId } = useSelectedMailbox();
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [disconnectingMailbox, setDisconnectingMailbox] = useState<{
		id: string;
		email: string;
	} | null>(null);

	if (!user) {
		return null;
	}

	// Loading state with skeleton
	if (isLoading) {
		return (
			<div className={className}>
				<div
					className={cn("flex w-full items-center gap-3", {
						"justify-center": collapsed,
					})}
				>
					<Skeleton
						className={cn("shrink-0 rounded-md", {
							"size-10": !collapsed,
							"size-8": collapsed,
						})}
					/>
					{!collapsed && (
						<div className="flex flex-1 flex-col gap-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-24" />
						</div>
					)}
				</div>
			</div>
		);
	}

	// Error state with retry
	if (error) {
		const errorContent = (
			<div
				className={cn(
					"flex w-full items-center gap-3 text-destructive",
					{
						"justify-center": collapsed,
					},
				)}
			>
				<AlertCircleIcon
					className={cn("shrink-0", {
						"size-10": !collapsed,
						"size-8": collapsed,
					})}
				/>
				{!collapsed && (
					<div className="flex flex-1 flex-col">
						<p className="text-sm font-medium">
							{t("mailboxes.mailboxSelect.error")}
						</p>
						<Button
							variant="link"
							size="sm"
							className="h-auto justify-start p-0 text-xs"
							onClick={() =>
								queryClient.invalidateQueries({
									queryKey: mailboxesQueryKey,
								})
							}
						>
							{t("mailboxes.mailboxSelect.retry")}
						</Button>
					</div>
				)}
			</div>
		);

		if (collapsed) {
			return (
				<div className={className}>
					<TooltipProvider delayDuration={0}>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="px-2 py-2">{errorContent}</div>
							</TooltipTrigger>
							<TooltipContent side="right">
								{t("mailboxes.mailboxSelect.error")}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			);
		}

		return <div className={className}>{errorContent}</div>;
	}

	const hasMailboxes = mailboxes.length > 0;
	const selectedMailbox =
		mailboxes.find((m) => m.id === selectedMailboxId) ||
		mailboxes[0] ||
		null;

	const triggerButton = (
		<DropdownMenuTrigger
			className={cn(
				"flex w-full items-center justify-between gap-3 text-left outline-none transition-colors",
				{
					"justify-center": collapsed,
					"px-2 py-2 rounded-lg hover:bg-muted/50": collapsed,
				},
			)}
		>
			<div
				className={cn(
					"flex flex-1 items-center gap-3 overflow-hidden",
					{
						"flex-1 flex justify-center": collapsed,
					},
				)}
			>
				{hasMailboxes ? (
					<>
						<UserAvatar
							className={cn("shrink-0 rounded-md", {
								"size-10": !collapsed,
								"size-8": collapsed,
							})}
							name={
								selectedMailbox?.name ||
								selectedMailbox?.email ||
								""
							}
							avatarUrl={selectedMailbox?.picture}
						/>
						{!collapsed && (
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-semibold text-foreground">
									{selectedMailbox?.name ||
										selectedMailbox?.email}
								</span>
								{mailboxes.length > 1 && (
									<span className="truncate text-xs text-muted-foreground">
										{t(
											"mailboxes.mailboxSelect.otherMailboxes",
											{
												count: mailboxes.length - 1,
											},
										)}
									</span>
								)}
							</div>
						)}
					</>
				) : (
					<>
						<div
							className={cn(
								"flex shrink-0 items-center justify-center rounded-md bg-muted",
								{
									"size-10": !collapsed,
									"size-8": collapsed,
								},
							)}
						>
							<span className="text-muted-foreground">@</span>
						</div>
						{!collapsed && (
							<div className="flex min-w-0 flex-1 flex-col">
								<span className="truncate text-sm font-semibold text-foreground">
									{t("mailboxes.mailboxSelect.noMailbox")}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{t("mailboxes.mailboxSelect.addMailbox")}
								</span>
							</div>
						)}
					</>
				)}
			</div>

			{!collapsed && (
				<ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
			)}
		</DropdownMenuTrigger>
	);

	const triggerContent = collapsed ? (
		<Tooltip>
			<TooltipTrigger asChild>{triggerButton}</TooltipTrigger>
			<TooltipContent side="right">
				{hasMailboxes
					? selectedMailbox?.name || selectedMailbox?.email
					: t("mailboxes.mailboxSelect.noMailbox")}
			</TooltipContent>
		</Tooltip>
	) : (
		triggerButton
	);

	const dropdownContent = (
		<DropdownMenuContent className="w-full">
			<DropdownMenuLabel className="text-foreground text-xs">
				{t("mailboxes.mailboxSelect.mailboxes")}
			</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				value={selectedMailbox?.id || ""}
				onValueChange={(value) => setSelectedMailboxId(value)}
			>
				{mailboxes.map((mailbox) => (
					<DropdownMenuRadioItem
						key={mailbox.id}
						value={mailbox.id}
						className="flex cursor-pointer items-center justify-center gap-2 pl-3"
					>
						<div className="flex flex-1 items-center justify-start gap-2">
							<UserAvatar
								className="size-8"
								name={mailbox.name || mailbox.email}
								avatarUrl={mailbox.picture}
							/>
							<div className="flex flex-col">
								<span className="text-sm">
									{mailbox.name || mailbox.email}
								</span>
								<span className="text-xs text-muted-foreground">
									{mailbox.email}
								</span>
							</div>
						</div>
						{mailboxes.length > 1 && (
							<TooltipProvider delayDuration={0}>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											type="button"
											className="ml-auto rounded-sm p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 [div:hover>&]:opacity-100"
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												setDisconnectingMailbox({
													id: mailbox.id,
													email: mailbox.email,
												});
											}}
										>
											<UnlinkIcon className="size-3.5" />
										</button>
									</TooltipTrigger>
									<TooltipContent>
										{t(
											"mailboxes.disconnectDialog.tooltip",
										)}
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>

			<DropdownMenuSeparator />

			<DropdownMenuGroup>
				<DropdownMenuItem
					className={cn(
						"cursor-pointer text-sm",
						"text-primary hover:text-primary/90 focus:text-primary",
					)}
					onClick={() => setIsAddDialogOpen(true)}
				>
					<PlusIcon className="mr-2 size-6 rounded-md bg-primary/20 p-1" />
					{t("mailboxes.mailboxSelect.addNewMailbox")}
				</DropdownMenuItem>
			</DropdownMenuGroup>
		</DropdownMenuContent>
	);

	const content = (
		<>
			<DropdownMenu>
				{triggerContent}
				{dropdownContent}
			</DropdownMenu>
			<AddMailboxDialog
				open={isAddDialogOpen}
				onOpenChange={setIsAddDialogOpen}
				existingMailboxes={mailboxes}
			/>
			{disconnectingMailbox && (
				<DisconnectMailboxDialog
					open={!!disconnectingMailbox}
					onOpenChange={(open) => {
						if (!open) {
							setDisconnectingMailbox(null);
						}
					}}
					mailboxId={disconnectingMailbox.id}
					mailboxEmail={disconnectingMailbox.email}
				/>
			)}
		</>
	);

	if (collapsed) {
		return (
			<div className={className}>
				<TooltipProvider delayDuration={0}>{content}</TooltipProvider>
			</div>
		);
	}

	return <div className={className}>{content}</div>;
}
