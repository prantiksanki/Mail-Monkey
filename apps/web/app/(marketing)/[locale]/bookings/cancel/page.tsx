import { CancelBookingCard } from "@marketing/profile/components/CancelBookingCard";
import { setRequestLocale } from "next-intl/server";

export default async function CancelBookingPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<div className="container max-w-md px-6 pt-24 pb-20">
			<CancelBookingCard />
		</div>
	);
}
