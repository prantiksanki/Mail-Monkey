import { getSignedUrl } from "@repo/storage";
import { NextResponse } from "next/server";

export const GET = async (
	_req: Request,
	{ params }: { params: Promise<{ path: string[] }> },
) => {
	const { path } = await params;

	const [bucket, rawFilePath] = path;

	if (!(bucket && rawFilePath)) {
		return new Response("Invalid path", { status: 400 });
	}

	// The stored avatar URL carries a cache-busting `?v=<timestamp>` suffix so
	// that the URL changes on every re-upload. Strip it before resolving the
	// actual storage object, whose key is always `${user.id}.png`.
	const filePath = rawFilePath.split("?")[0];

	if (bucket === "avatars") {
		const signedUrl = await getSignedUrl(filePath, {
			bucket,
			expiresIn: 60 * 60,
		});

		return NextResponse.redirect(signedUrl, {
			headers: { "Cache-Control": "max-age=3600" },
		});
	}

	return new Response("Not found", {
		status: 404,
	});
};
