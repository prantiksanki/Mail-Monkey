import { defineConfig, env } from "prisma/config";

export default defineConfig({
	schema: "./prisma/schema.prisma",
	datasource: {
		// Prisma 7.10 dropped `directUrl`; this URL is only used by the CLI
		// (migrations), so prefer the direct connection when it is set.
		url: process.env.DIRECT_URL ?? env("DATABASE_URL"),
	},
});
