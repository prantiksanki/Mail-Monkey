import { ResetPasswordForm } from "@saas/auth/components/ResetPasswordForm";
import { AuthWrapper } from "@saas/shared/components/AuthWrapper";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("auth.resetPassword.title"),
	};
}

export default function ResetPasswordPage() {
	return (
		<AuthWrapper>
			<ResetPasswordForm />
		</AuthWrapper>
	);
}
