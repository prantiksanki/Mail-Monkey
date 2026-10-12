import { db } from "../client";
import type { Prisma } from "../generated/client";

export interface ProfileLink {
	label: string;
	url?: string;
	type?: "url" | "contact-form";
	platform?:
		| "website"
		| "instagram"
		| "facebook"
		| "x"
		| "linkedin"
		| "github"
		| "tiktok"
		| "youtube"
		| "custom";
	featured?: boolean;
	enabled?: boolean;
}

export interface MediaKitStat {
	label: string;
	value: string;
}

export interface MediaKitCollaboration {
	label: string;
	url?: string;
}

export interface MediaKitRateCardItem {
	label: string;
	price: string;
}

export interface MediaKit {
	stats?: MediaKitStat[];
	collaborations?: MediaKitCollaboration[];
	rateCard?: MediaKitRateCardItem[];
}

export interface ProfileDesign {
	buttonStyle?: "fill" | "outline" | "soft";
	backgroundColor?: string;
	textColor?: string;
	font?: string;
	wallpaperStyle?: "fill" | "gradient" | "blur" | "pattern" | "background";
	patternType?: "noise" | "grid" | "blob" | "dots";
	backgroundType?:
		| "sunset"
		| "ocean"
		| "forest"
		| "candy"
		| "midnight"
		| "peach"
		| "prism"
		| "lava"
		| "plasma"
		| "pulse"
		| "vortex"
		| "mist"
		| "stars"
		| "particles"
		| "sunsetGlow"
		| "oceanicDepth"
		| "forestCanopy"
		| "cosmicNebula"
		| "desertDawn"
		| "fieryEmbers"
		| "lavenderDreams"
		| "arcticHaze"
		| "retroWave"
		| "violetGlow"
		| "elegantDark"
		| "livingOrigami"
		| "paperShader"
		| "softGlow";
	wallpaperOpacity?: number;
}

export async function getCreatorProfileByUserId(userId: string) {
	return db.creatorProfile.findUnique({
		where: { userId },
	});
}

/** Public profile lookup: joins the enabled profile with its owning user's public fields. */
export async function getPublicCreatorProfileByUsername(username: string) {
	const user = await db.user.findUnique({
		where: { username },
		select: {
			id: true,
			name: true,
			username: true,
			image: true,
			accountType: true,
			creatorProfile: true,
		},
	});

	if (!user?.creatorProfile?.enabled) {
		return null;
	}

	return user;
}

/** Same as above, but also loads the weekly availability windows for slot computation. */
export async function getBookablePublicProfileByUsername(username: string) {
	const user = await db.user.findUnique({
		where: { username },
		select: {
			id: true,
			name: true,
			username: true,
			creatorProfile: {
				include: {
					availability: {
						orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
					},
				},
			},
		},
	});

	if (!user?.creatorProfile?.enabled || !user.creatorProfile.bookingEnabled) {
		return null;
	}

	return user;
}

export async function upsertCreatorProfile(
	userId: string,
	data: {
		displayName?: string | null;
		avatarUrl?: string | null;
		bio?: string | null;
		links?: ProfileLink[];
		enabled?: boolean;
		bookingEnabled?: boolean;
		bookingTimezone?: string;
		meetingLengthMinutes?: number;
		accentColor?: string;
		layout?: "STANDARD" | "COMPACT";
		design?: ProfileDesign;
		mediaKitEnabled?: boolean;
		mediaKit?: MediaKit;
		tags?: string[];
		directoryListed?: boolean;
		paidBookingEnabled?: boolean;
	},
) {
	const links = data.links as Prisma.InputJsonValue | undefined;
	const mediaKit = data.mediaKit as Prisma.InputJsonValue | undefined;
	const design = data.design as Prisma.InputJsonValue | undefined;

	return db.creatorProfile.upsert({
		where: { userId },
		create: {
			userId,
			displayName: data.displayName,
			avatarUrl: data.avatarUrl,
			bio: data.bio,
			links: links ?? [],
			enabled: data.enabled ?? false,
			accentColor: data.accentColor,
			layout: data.layout,
			design: design ?? {},
			mediaKitEnabled: data.mediaKitEnabled ?? false,
			mediaKit: mediaKit ?? {},
			tags: data.tags ?? [],
			directoryListed: data.directoryListed ?? false,
			paidBookingEnabled: data.paidBookingEnabled ?? false,
		},
		update: {
			...data,
			links,
			mediaKit,
			design,
		},
	});
}
