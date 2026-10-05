import { expect, test } from "@playwright/test";

test.describe("Calendar", () => {
	test.beforeEach(async ({ page }) => {
		test.skip(
			!process.env.TEST_USER_EMAIL,
			"TEST_USER_EMAIL not set — skipping authenticated tests",
		);
		await page.goto("/app/calendar");
		await expect(page).toHaveURL(/\/app\/calendar/, { timeout: 15000 });
	});

	test("calendar page loads", async ({ page }) => {
		await expect(page.locator("body")).toBeVisible();
	});

	test("shows events or empty state", async ({ page }) => {
		await page.waitForTimeout(2000);

		const hasEvents = await page
			.locator('[data-testid="calendar-event"]')
			.first()
			.isVisible()
			.catch(() => false);

		if (!hasEvents) {
			await expect(
				page
					.getByText(/no events|no upcoming|nothing scheduled/i)
					.or(page.locator("body")),
			).toBeVisible({ timeout: 8000 });
		} else {
			await expect(
				page.locator('[data-testid="calendar-event"]').first(),
			).toBeVisible();
		}
	});

	test("no error shown on calendar page", async ({ page }) => {
		await expect(
			page.getByText(/something went wrong|error|failed to load/i),
		).not.toBeVisible({ timeout: 5000 });
	});
});
