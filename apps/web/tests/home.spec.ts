import { expect, test } from "@playwright/test";
import { config } from "@/config";

test.describe("home page", () => {
	if (config.marketing.enabled) {
		test("should load", async ({ page }) => {
			await page.goto("/");

			await expect(
				page.getByRole("heading", {
					name: /meet\s*your\s*ai\s*chief\s*of\s*staff\s*for\s*email\./i,
				}),
			).toBeVisible();
		});
	} else {
		test("should be redirected to app", async ({ page }) => {
			await page.goto("/");

			await expect(page).toHaveURL(/\.*\/auth\/login/);
		});
	}
});
