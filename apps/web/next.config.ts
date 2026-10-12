import path from "node:path";
import { withContentCollections } from "@content-collections/next";
// @ts-expect-error - PrismaPlugin is not typed
import { PrismaPlugin } from "@prisma/nextjs-monorepo-workaround-plugin";
import type { NextConfig } from "next";
import nextIntlPlugin from "next-intl/plugin";

const withNextIntl = nextIntlPlugin("./modules/i18n/request.ts");
const strictTransportSecurity = "max-age=63072000; includeSubDomains";
// Lock down powerful features the app never uses. `microphone` is deliberately
// omitted (the marketing voice demo calls getUserMedia) so it keeps the
// browser default of `self`.
const permissionsPolicy = "camera=(), geolocation=(), browsing-topics=()";
const repoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
	output: "standalone",
	outputFileTracingRoot: repoRoot,
	// Don't advertise the framework in an `X-Powered-By` response header.
	poweredByHeader: false,
	serverExternalPackages: ["sharp"],
	// Allow ngrok URLs during local development
	allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev", "*.ngrok.io"],
	turbopack: {
		root: repoRoot,
	},
	transpilePackages: [
		"@repo/api",
		"@repo/auth",
		"@repo/database",
		"@repo/i18n",
		"@repo/logs",
		"@repo/mail",
		"@repo/payments",
		"@repo/storage",
		"@repo/ui",
		"@repo/utils",
	],
	images: {
		remotePatterns: [
			{
				// google profile images
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
			},
			{
				// placeholder images
				protocol: "https",
				hostname: "picsum.photos",
			},
			{
				protocol: "https",
				hostname: "images.unsplash.com",
			},
			{
				// randomuser.me portrait photos for testimonials
				protocol: "https",
				hostname: "randomuser.me",
			},
			{
				// Medium's image CDN, for blog posts cross-published from Medium
				protocol: "https",
				hostname: "miro.medium.com",
			},
		],
	},
	async redirects() {
		return [
			{
				source: "/:path*",
				has: [{ type: "host", value: "zer0email.com" }],
				destination: "https://popsuites.ai/:path*",
				permanent: true,
			},
			{
				source: "/:path*",
				has: [{ type: "host", value: "www.zer0email.com" }],
				destination: "https://popsuites.ai/:path*",
				permanent: true,
			},
			{
				source: "/privacy",
				destination: "/legal/privacy-policy",
				permanent: true,
			},
			{
				source: "/terms",
				destination: "/legal/terms",
				permanent: true,
			},
			{
				source: "/app/settings",
				destination: "/app/settings/general",
				permanent: true,
			},
			{
				source: "/app/:organizationSlug/settings",
				destination: "/app/:organizationSlug/settings/general",
				permanent: true,
			},
			{
				source: "/app/admin",
				destination: "/app/admin/users",
				permanent: true,
			},
		];
	},
	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Strict-Transport-Security",
						value: strictTransportSecurity,
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Permissions-Policy",
						value: permissionsPolicy,
					},
					{
						// Every asset here is same-origin (self-hosted static
						// files, the /_next/image proxy, Azure Blob URLs
						// referenced only from our own pages) — nothing else
						// should be able to `<img>`/`<script>` these responses
						// cross-origin.
						key: "Cross-Origin-Resource-Policy",
						value: "same-origin",
					},
				],
			},
		];
	},
	webpack: (config, { webpack, isServer }) => {
		config.plugins.push(
			new webpack.IgnorePlugin({
				resourceRegExp: /^pg-native$|^cloudflare:sockets$/,
			}),
		);

		if (isServer) {
			config.plugins.push(new PrismaPlugin());
		}

		return config;
	},
};

export default withContentCollections(withNextIntl(nextConfig));
