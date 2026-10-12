import { BookingPageContent } from "@marketing/profile/components/BookingPageContent";
import { getPublicCreatorProfileByUsername } from "@repo/database";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

interface PageParams {
	locale: string;
	username: string;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<PageParams>;
}): Promise<Metadata> {
	const { username } = await params;
	const profile = await getPublicCreatorProfileByUsername(username);

	if (!profile) {
		return { title: "Profile not found" };
	}

	const displayName = profile.creatorProfile?.displayName || profile.name;
	return { title: `Book time with ${displayName}` };
}

export default async function BookingPage({
	params,
}: {
	params: Promise<PageParams>;
}) {
	const { locale, username } = await params;
	setRequestLocale(locale);

	const profile = await getPublicCreatorProfileByUsername(username);

	if (!profile || !profile.creatorProfile?.bookingEnabled) {
		notFound();
	}

	const displayName = profile.creatorProfile.displayName || profile.name;

	return (
		<div className="container max-w-4xl px-6 pt-24 pb-20">
			<BookingPageContent
				username={username}
				displayName={displayName}
				meetingLengthMinutes={
					profile.creatorProfile.meetingLengthMinutes
				}
				paidBookingEnabled={profile.creatorProfile.paidBookingEnabled}
			/>
		</div>
	);
}
