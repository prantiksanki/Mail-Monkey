"use client";

import { Button } from "@repo/ui/components/button";
import {
	CheckIcon,
	CopyIcon,
	ExternalLinkIcon,
	Loader2Icon,
} from "lucide-react";
import type { PropsWithChildren } from "react";

import { PhonePreview } from "./PhonePreview";
import type { MyPageState } from "./useMyPageState";

export function MyPageShell({
	state,
	children,
}: PropsWithChildren<{ state: MyPageState }>) {
	const {
		blocks,
		design,
		isLoading,
		hasUsername,
		displayUrl,
		copied,
		onCopyLink,
		onViewLive,
		onSave,
		saving,
	} = state;

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-wrap items-center justify-between gap-4">
				<div>
					<h1 className="font-serif text-3xl leading-none tracking-tight">
						My Page
					</h1>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<span className="rounded-full border border-border bg-muted px-3 py-1.5 text-foreground/70 text-sm">
						{displayUrl}
					</span>
					<Button
						variant="outline"
						size="sm"
						onClick={onCopyLink}
						disabled={!hasUsername}
					>
						{copied ? (
							<CheckIcon className="size-3.5" />
						) : (
							<CopyIcon className="size-3.5" />
						)}
						{copied ? "Copied!" : "Copy link"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={onViewLive}
						disabled={!hasUsername}
					>
						<ExternalLinkIcon className="size-3.5" />
						View live
					</Button>
					<Button size="sm" onClick={onSave} loading={saving}>
						Save
					</Button>
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center gap-2 py-24 text-foreground/50 text-sm">
					<Loader2Icon className="size-4 animate-spin" />
					Loading your page…
				</div>
			) : (
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_460px]">
					<div className="flex justify-center">
						<div className="flex w-full max-w-xl flex-col gap-3">
							{children}
						</div>
					</div>
					<PhonePreview blocks={blocks} design={design} />
				</div>
			)}
		</div>
	);
}
