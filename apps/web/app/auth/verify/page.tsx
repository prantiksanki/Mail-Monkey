import { OtpForm } from "@saas/auth/components/OtpForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("auth.verify.title"),
	};
}

export default function VerifyPage() {
	return (
		<AuthWrapper>
			<OtpForm />
		</AuthWrapper>
	);
}
