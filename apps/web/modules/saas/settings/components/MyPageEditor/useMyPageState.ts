"use client";

import { getBaseUrl } from "@repo/utils/lib/base-url";
import { useSession } from "@saas/auth/hooks/use-session";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	type Block,
	type DayWindow,
	type DesignData,
	HEX_COLOR,
	type LinkRow,
} from "./types";

function emptyBlocks(displayName: string, username: string): Block[] {
	return [
		{
			id: "profile",
			type: "profile",
			enabled: true,
			data: { displayName, username, bio: "", avatarUrl: null },
		},
		{ id: "links", type: "links", enabled: true, data: [] },
		{
			id: "booking",
			type: "booking",
			enabled: true,
			data: { days: {}, note: "" },
		},
	];
}

const emptyDesign: DesignData = {
	headerLayout: "STANDARD",
	buttonStyle: "fill",
	accentColor: "#6E3BFF",
	backgroundColor: "#FFFFFF",
	textColor: "#111111",
	font: "inter",
	wallpaperStyle: "fill",
	patternType: "noise",
	backgroundType: "sunset",
	wallpaperOpacity: 1,
};

function getBlock<T extends Block["type"]>(
	blocks: Block[],
	type: T,
): Extract<Block, { type: T }> {
	const block = blocks.find((b) => b.type === type);
	if (!block) {
		throw new Error(`Missing ${type} block`);
	}
	return block as Extract<Block, { type: T }>;
}

function normalizeUrl(url: string) {
	const trimmed = url.trim();
	if (!trimmed) {
		return "";
	}
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function useMyPageState() {
	const { user, reloadSession } = useSession();
	const username = user?.username ?? "";
	const pageUrl = `${getBaseUrl()}/u/${username}`;
	const displayUrl = pageUrl.replace(/^https?:\/\//, "");
	const hasUsername = Boolean(username);

	const profileQuery = useQuery(orpc.creatorProfiles.me.queryOptions());

	const [blocks, setBlocks] = useState<Block[]>(() =>
		emptyBlocks(user?.name ?? "", username),
	);
	const [design, setDesign] = useState<DesignData>(emptyDesign);
	const [copied, setCopied] = useState(false);
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		if (!profileQuery.data || loaded) {
			return;
		}
		const data = profileQuery.data;

		const days: Record<number, DayWindow> = {};
		for (const window of data.availability) {
			// API weekdays are 0=Sunday..6=Saturday; the editor's DAY_KEYS run
			// Mon..Sun, so shift Sunday (0) to the end (index 6).
			const dayIndex = window.dayOfWeek === 0 ? 6 : window.dayOfWeek - 1;
			days[dayIndex] = {
				startTime: window.startTime,
				endTime: window.endTime,
			};
		}

		const links: LinkRow[] = data.links.map((link, index) => ({
			id: `link-${index}-${link.label}`,
			type: link.type ?? "url",
			platform: link.platform ?? "website",
			label: link.label,
			url: link.url ?? "",
			enabled: link.enabled ?? true,
			featured: link.featured ?? false,
		}));

		setBlocks([
			{
				id: "profile",
				type: "profile",
				enabled: data.enabled,
				data: {
					// The public page's name/photo default to the account's
					// (user.name/user.image) but can be overridden here —
					// data.displayName/avatarUrl only carry a value once the
					// creator has set a My-Page-specific one.
					displayName: data.displayName || user?.name || "",
					username,
					bio: data.bio,
					avatarUrl: data.avatarUrl ?? user?.image ?? null,
				},
			},
			{ id: "links", type: "links", enabled: true, data: links },
			{
				id: "booking",
				type: "booking",
				enabled: data.bookingEnabled,
				data: { days, note: "" },
			},
		]);
		setDesign({
			headerLayout: data.layout,
			buttonStyle: data.design.buttonStyle ?? "fill",
			accentColor: data.accentColor,
			backgroundColor: data.design.backgroundColor ?? "#FFFFFF",
			textColor: data.design.textColor ?? "#111111",
			font: (data.design.font as DesignData["font"]) ?? "inter",
			wallpaperStyle:
				(data.design.wallpaperStyle as DesignData["wallpaperStyle"]) ??
				"fill",
			patternType:
				(data.design.patternType as DesignData["patternType"]) ??
				"noise",
			backgroundType:
				(data.design.backgroundType as DesignData["backgroundType"]) ??
				"sunset",
			wallpaperOpacity: data.design.wallpaperOpacity ?? 1,
		});
		setLoaded(true);
	}, [profileQuery.data, loaded, user?.name, user?.image, username]);

	const updateBlock = (id: string, next: Partial<Block>) => {
		setBlocks((prev) =>
			prev.map((b) => (b.id === id ? ({ ...b, ...next } as Block) : b)),
		);
	};

	const onCopyLink = async () => {
		try {
			await navigator.clipboard.writeText(pageUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard API unavailable — no-op
		}
	};

	const onViewLive = () => {
		window.open(pageUrl, "_blank", "noopener,noreferrer");
	};

	const updateProfileMutation = useMutation(
		orpc.creatorProfiles.update.mutationOptions(),
	);
	const updateBookingMutation = useMutation(
		orpc.creatorProfiles.updateBookingSettings.mutationOptions(),
	);
	const updateBrandingMutation = useMutation(
		orpc.creatorProfiles.updateBranding.mutationOptions(),
	);

	const onSave = async () => {
		const profileBlock = getBlock(blocks, "profile");
		const linksBlock = getBlock(blocks, "links");
		const bookingBlock = getBlock(blocks, "booking");

		// Skip rows with no label or (for real URL links) no URL yet — an
		// in-progress empty row shouldn't fail the whole save.
		const links = linksBlock.data
			.filter((link) =>
				link.type === "contact-form"
					? link.label.trim()
					: link.label.trim() && link.url.trim(),
			)
			.map((link) => ({
				label: link.label.trim(),
				url:
					link.type === "contact-form"
						? undefined
						: normalizeUrl(link.url),
				type: link.type,
				platform: link.platform,
				featured: link.featured,
				enabled: link.enabled,
			}));

		const availability = Object.entries(bookingBlock.data.days)
			.filter(
				(entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
					Boolean(entry[1]),
			)
			.map(([dayIndex, window]) => ({
				// Reverse the Mon..Sun (0-6) -> Sun..Sat (0-6) shift from load.
				dayOfWeek: (Number(dayIndex) + 1) % 7,
				startTime: window.startTime,
				endTime: window.endTime,
			}));

		try {
			await Promise.all([
				updateProfileMutation.mutateAsync({
					displayName: profileBlock.data.displayName.trim(),
					avatarUrl: profileBlock.data.avatarUrl,
					bio: profileBlock.data.bio,
					enabled: profileBlock.enabled,
					links,
				}),
				updateBookingMutation.mutateAsync({
					bookingEnabled: bookingBlock.enabled,
					availability,
				}),
				updateBrandingMutation.mutateAsync({
					accentColor: HEX_COLOR.test(design.accentColor)
						? design.accentColor
						: "#6E3BFF",
					layout: design.headerLayout,
					design: {
						buttonStyle: design.buttonStyle,
						backgroundColor: HEX_COLOR.test(design.backgroundColor)
							? design.backgroundColor
							: "#FFFFFF",
						textColor: HEX_COLOR.test(design.textColor)
							? design.textColor
							: "#111111",
						font: design.font,
						wallpaperStyle:
							design.wallpaperStyle === "image"
								? "fill"
								: design.wallpaperStyle,
						patternType: design.patternType,
						backgroundType: design.backgroundType,
						wallpaperOpacity: design.wallpaperOpacity,
					},
				}),
			]);
			toast.success("My Page saved");
			profileQuery.refetch();
		} catch (error) {
			toast.error(
				error instanceof Error
					? `Couldn't save My Page: ${error.message}`
					: "Couldn't save My Page",
			);
		}
	};

	const saving =
		updateProfileMutation.isPending ||
		updateBookingMutation.isPending ||
		updateBrandingMutation.isPending;

	return {
		blocks,
		design,
		setDesign,
		updateBlock,
		getBlock,
		isLoading: profileQuery.isLoading,
		hasUsername,
		pageUrl,
		displayUrl,
		copied,
		onCopyLink,
		onViewLive,
		onSave,
		saving,
		reloadSession,
	};
}

export type MyPageState = ReturnType<typeof useMyPageState>;
