import { Logo } from "@repo/ui";
import { getSession } from "@saas/auth/lib/server";
import { ChangePasswordForm } from "@saas/settings/components/ChangePassword";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata() {
	const t = await getTranslations();

	return {
		title: t("forcePasswordChange.title"),
	};
}

export default async function ForcePasswordChangePage() {
	const t = await getTranslations();
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	// Nothing left to enforce once the password has been changed — send the
	// user on into the app rather than letting them linger here.
	if (!session.user.mustChangePassword) {
		redirect("/app");
	}

	return (
		<div className="flex min-h-screen w-full flex-col items-center justify-center gap-8 bg-background px-4 text-foreground">
			<Logo />

			<div className="w-full max-w-md">
				<div className="mb-6 text-center">
					<h1 className="font-semibold text-2xl tracking-[-0.02em]">
						{t("forcePasswordChange.title")}
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						{t("forcePasswordChange.message")}
					</p>
				</div>

				<ChangePasswordForm />
			</div>
		</div>
	);
}
