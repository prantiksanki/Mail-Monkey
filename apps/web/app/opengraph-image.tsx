import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Zer0Email — AI Chief of Staff for Email";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
	return new ImageResponse(
		<div
			style={{
				background: "#000000",
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "sans-serif",
				padding: "60px",
			}}
		>
			<div
				style={{
					color: "white",
					fontSize: 80,
					fontWeight: 700,
					letterSpacing: "-0.03em",
					lineHeight: 1,
				}}
			>
				Zer0Email
			</div>
			<div
				style={{
					color: "rgba(255,255,255,0.65)",
					fontSize: 34,
					marginTop: 24,
					textAlign: "center",
					maxWidth: 760,
					lineHeight: 1.4,
				}}
			>
				AI Chief of Staff for Email
			</div>
			<div
				style={{
					color: "rgba(255,255,255,0.35)",
					fontSize: 20,
					marginTop: 40,
					letterSpacing: "0.1em",
					textTransform: "uppercase",
				}}
			>
				Backed by Google for Startups · NVIDIA Inception
			</div>
		</div>,
		{ ...size },
	);
}
