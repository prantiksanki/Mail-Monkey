import { z } from "zod";

export const linkPlatformSchema = z.enum([
	"website",
	"instagram",
	"facebook",
	"x",
	"linkedin",
	"github",
	"tiktok",
	"youtube",
	"custom",
]);

export const profileLinkSchema = z
	.object({
		label: z.string().min(1).max(40),
		url: z.string().url().optional(),
		type: z.enum(["url", "contact-form"]).optional(),
		platform: linkPlatformSchema.optional(),
		featured: z.boolean().optional(),
		enabled: z.boolean().optional(),
	})
	.refine((link) => link.type === "contact-form" || Boolean(link.url), {
		message: "URL is required",
		path: ["url"],
	});

export const updateCreatorProfileSchema = z.object({
	// Public-page identity, independent of the account's name/image. Null (or
	// empty string) clears the override and falls back to the account value.
	displayName: z.string().max(120).nullable().optional(),
	avatarUrl: z.string().max(300).nullable().optional(),
	bio: z.string().max(500).optional(),
	links: z.array(profileLinkSchema).max(10).optional(),
	enabled: z.boolean().optional(),
});

export type UpdateCreatorProfileValues = z.infer<
	typeof updateCreatorProfileSchema
>;

export const publicProfileContactFormSchema = z.object({
	username: z.string().min(1),
	name: z.string().min(2).max(120),
	email: z.string().email(),
	message: z.string().min(10).max(2000),
});

export type PublicProfileContactFormValues = z.infer<
	typeof publicProfileContactFormSchema
>;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");

export const weeklyWindowSchema = z
	.object({
		dayOfWeek: z.number().int().min(0).max(6),
		startTime: hhmm,
		endTime: hhmm,
	})
	.refine((w) => w.startTime < w.endTime, {
		message: "Start time must be before end time",
		path: ["endTime"],
	});

export const updateBookingSettingsSchema = z.object({
	bookingEnabled: z.boolean().optional(),
	bookingTimezone: z.string().min(1).optional(),
	meetingLengthMinutes: z.number().int().min(5).max(240).optional(),
	availability: z.array(weeklyWindowSchema).max(50).optional(),
});

export type UpdateBookingSettingsValues = z.infer<
	typeof updateBookingSettingsSchema
>;

export const getAvailableSlotsSchema = z.object({
	username: z.string().min(1),
	from: z.coerce.date(),
	to: z.coerce.date(),
});

export const createBookingSchema = z.object({
	username: z.string().min(1),
	visitorName: z.string().min(2).max(120),
	visitorEmail: z.string().email(),
	note: z.string().max(1000).optional(),
	startsAt: z.coerce.date(),
});

export type CreateBookingValues = z.infer<typeof createBookingSchema>;

export const cancelBookingSchema = z.object({
	cancelToken: z.string().min(1),
});

export const bookingActionSchema = z.object({
	bookingId: z.string().min(1),
});

const hexColor = z
	.string()
	.regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6E3BFF");

export const profileDesignSchema = z.object({
	buttonStyle: z.enum(["fill", "outline", "soft"]).optional(),
	backgroundColor: hexColor.optional(),
	textColor: hexColor.optional(),
	font: z.string().max(60).optional(),
	wallpaperStyle: z
		.enum(["fill", "gradient", "blur", "pattern", "background"])
		.optional(),
	patternType: z.enum(["noise", "grid", "blob", "dots"]).optional(),
	backgroundType: z
		.enum([
			"sunset",
			"ocean",
			"forest",
			"candy",
			"midnight",
			"peach",
			"prism",
			"lava",
			"plasma",
			"pulse",
			"vortex",
			"mist",
			"stars",
			"particles",
			"sunsetGlow",
			"oceanicDepth",
			"forestCanopy",
			"cosmicNebula",
			"desertDawn",
			"fieryEmbers",
			"lavenderDreams",
			"arcticHaze",
			"retroWave",
			"violetGlow",
			"elegantDark",
			"livingOrigami",
			"paperShader",
			"softGlow",
		])
		.optional(),
	wallpaperOpacity: z.number().min(0).max(1).optional(),
});

export const updateBrandingSchema = z.object({
	accentColor: hexColor.optional(),
	layout: z.enum(["STANDARD", "COMPACT"]).optional(),
	design: profileDesignSchema.optional(),
});

export type UpdateBrandingValues = z.infer<typeof updateBrandingSchema>;

export const mediaKitStatSchema = z.object({
	label: z.string().min(1).max(40),
	value: z.string().min(1).max(40),
});

export type MediaKitStat = z.infer<typeof mediaKitStatSchema>;

export const mediaKitCollaborationSchema = z.object({
	label: z.string().min(1).max(60),
	url: z.string().url().optional(),
});

export type MediaKitCollaboration = z.infer<typeof mediaKitCollaborationSchema>;

export const mediaKitRateCardItemSchema = z.object({
	label: z.string().min(1).max(60),
	price: z.string().min(1).max(40),
});

export type MediaKitRateCardItem = z.infer<typeof mediaKitRateCardItemSchema>;

export const updateMediaKitSchema = z.object({
	mediaKitEnabled: z.boolean().optional(),
	mediaKit: z
		.object({
			stats: z.array(mediaKitStatSchema).max(6).optional(),
			collaborations: z
				.array(mediaKitCollaborationSchema)
				.max(20)
				.optional(),
			rateCard: z.array(mediaKitRateCardItemSchema).max(10).optional(),
		})
		.optional(),
});

export type UpdateMediaKitValues = z.infer<typeof updateMediaKitSchema>;

export const getProfileAnalyticsSchema = z.object({
	rangeDays: z.number().int().min(1).max(90).default(30),
});

export const trackProfileEventSchema = z.object({
	username: z.string().min(1),
	type: z.enum(["VIEW", "CONTACT", "BOOKING"]),
});

const tagSchema = z
	.string()
	.trim()
	.min(2)
	.max(24)
	.regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, and hyphens only")
	.transform((tag) => tag.toLowerCase());

export const updateDirectorySettingsSchema = z.object({
	tags: z.array(tagSchema).max(8).optional(),
	directoryListed: z.boolean().optional(),
});

export type UpdateDirectorySettingsValues = z.infer<
	typeof updateDirectorySettingsSchema
>;

export const listDirectorySchema = z.object({
	tag: tagSchema.optional(),
	cursor: z.string().optional(),
	limit: z.number().int().min(1).max(48).default(24),
});

export const getSimilarProfilesSchema = z.object({
	username: z.string().min(1),
});
