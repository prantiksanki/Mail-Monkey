import { getSession } from "@saas/auth/lib/server";
import { MyPageProfilePage } from "@saas/settings/components/MyPageEditor";
import { redirect } from "next/navigation";

export async function generateMetadata() {
	return {
		title: "My Page — Profile",
	};
}

export default async function Page() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return <MyPageProfilePage />;
}
