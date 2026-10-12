import { getSession } from "@saas/auth/lib/server";
import { MyPageDesignPage } from "@saas/settings/components/MyPageEditor";
import { redirect } from "next/navigation";

export async function generateMetadata() {
	return {
		title: "My Page — Design",
	};
}

export default async function Page() {
	const session = await getSession();

	if (!session) {
		redirect("/auth/login");
	}

	return <MyPageDesignPage />;
}
