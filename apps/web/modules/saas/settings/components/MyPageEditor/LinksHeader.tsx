"use client";

import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/avatar";
import { Button } from "@repo/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { Textarea } from "@repo/ui/components/textarea";
import { ChevronDownIcon, MailIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { PLATFORM_META, PLATFORM_ORDER } from "./platforms";
import type { Platform, ProfileData } from "./types";

const BIO_MAX = 160;

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

export function LinksHeader({
	profile,
	onChangeBio,
	onAddLink,
	onAddContactForm,
}: {
	profile: ProfileData;
	onChangeBio: (bio: string) => void;
	onAddLink: (platform?: Platform) => void;
	onAddContactForm: () => void;
}) {
	const [editingBio, setEditingBio] = useState(false);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-4">
				<Avatar className="size-16 rounded-full">
					{profile.avatarUrl && (
						<AvatarImage src={profile.avatarUrl} />
					)}
					<AvatarFallback className="rounded-full bg-[#EEF2FF] text-[#4F46E5] text-lg">
						{initials(profile.displayName)}
					</AvatarFallback>
				</Avatar>
				<div className="flex-1">
					<p className="font-semibold text-base">
						{profile.username || profile.displayName || "Your page"}
					</p>
					{editingBio ? (
						<Textarea
							autoFocus
							value={profile.bio}
							maxLength={BIO_MAX}
							onChange={(e) => onChangeBio(e.target.value)}
							onBlur={() => setEditingBio(false)}
							placeholder="Add bio"
							rows={2}
							className="mt-1 text-sm"
						/>
					) : (
						<button
							type="button"
							onClick={() => setEditingBio(true)}
							className="text-left text-foreground/50 text-sm hover:text-foreground/70"
						>
							{profile.bio || "Add bio"}
						</button>
					)}
				</div>
			</div>

			<Button
				type="button"
				size="lg"
				className="w-full rounded-full font-semibold"
				onClick={() => onAddLink()}
			>
				<PlusIcon className="size-4" />
				Add
			</Button>

			<div className="flex flex-wrap items-center gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="w-fit"
					onClick={onAddContactForm}
				>
					<MailIcon className="size-3.5" />
					Add contact form
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="w-fit"
						>
							Quick add
							<ChevronDownIcon className="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{PLATFORM_ORDER.filter((p) => p !== "custom").map(
							(platform) => (
								<DropdownMenuItem
									key={platform}
									onClick={() => onAddLink(platform)}
									className="gap-2"
								>
									{PLATFORM_META[platform].icon("size-3.5")}
									{PLATFORM_META[platform].label}
								</DropdownMenuItem>
							),
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}
