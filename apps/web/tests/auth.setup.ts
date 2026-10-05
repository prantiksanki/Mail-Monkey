import path from "node:path";
import { expect, test as setup } from "@playwright/test";

export const AUTH_FILE = path.join(__dirname, ".auth/user.json");
export const ADMIN_AUTH_FILE = path.join(__dirname, ".auth/admin.json");

setup("authenticate as regular user", async ({ page }) => {
	const email = process.env.TEST_USER_EMAIL;
	const password = process.env.TEST_USER_PASSWORD;

	if (!email || !password) {
		console.warn(
			"TEST_USER_EMAIL / TEST_USER_PASSWORD not set — skipping user auth setup",
		);
		await page.context().storageState({ path: AUTH_FILE });
		return;
	}

	await page.goto("/auth/login");
	await page.getByLabel(/email/i).fill(email);
	await page.getByLabel(/password/i).fill(password);
	await page.getByRole("button", { name: /sign in|log in/i }).click();

	await expect(page).toHaveURL(/\/app/, { timeout: 15000 });

	await page.context().storageState({ path: AUTH_FILE });
});

setup("authenticate as admin user", async ({ page }) => {
	const email = process.env.TEST_ADMIN_EMAIL;
	const password = process.env.TEST_ADMIN_PASSWORD;

	if (!email || !password) {
		console.warn(
			"TEST_ADMIN_EMAIL / TEST_ADMIN_PASSWORD not set — skipping admin auth setup",
		);
		await page.context().storageState({ path: ADMIN_AUTH_FILE });
		return;
	}

	await page.goto("/auth/login");
	await page.getByLabel(/email/i).fill(email);
	await page.getByLabel(/password/i).fill(password);
	await page.getByRole("button", { name: /sign in|log in/i }).click();

	await expect(page).toHaveURL(/\/app/, { timeout: 15000 });

	await page.context().storageState({ path: ADMIN_AUTH_FILE });
});
