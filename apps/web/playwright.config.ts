import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

const AUTH_FILE = path.join(__dirname, "tests/.auth/user.json");
const ADMIN_AUTH_FILE = path.join(__dirname, "tests/.auth/admin.json");

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [["html"]],
	use: {
		baseURL: "http://localhost:3000",
		trace: "on-first-retry",
		video: {
			mode: "retain-on-failure",
			size: { width: 1280, height: 720 },
		},
		screenshot: "only-on-failure",
	},
	projects: [
		{
			name: "setup",
			testMatch: /.*\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: AUTH_FILE,
			},
			dependencies: ["setup"],
			testIgnore: [
				"**/auth.spec.ts",
				"**/admin.spec.ts",
				"**/marketing.spec.ts",
			],
		},
		{
			name: "admin",
			use: {
				...devices["Desktop Chrome"],
				storageState: ADMIN_AUTH_FILE,
			},
			dependencies: ["setup"],
			testMatch: "**/admin.spec.ts",
		},
		{
			name: "no-auth",
			use: { ...devices["Desktop Chrome"] },
			testMatch: [
				"**/marketing.spec.ts",
				"**/auth.spec.ts",
				"**/oauth.spec.ts",
			],
		},
	],
	webServer: {
		command: "pnpm --filter web run build && pnpm --filter web run start",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		stdout: "pipe",
		timeout: 180 * 1000,
	},
});
