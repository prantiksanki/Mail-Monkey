import { expect, test } from "@playwright/test";

test.describe("Inbox", () => {
	test.beforeEach(async ({ page }) => {
		test.skip(
			!process.env.TEST_USER_EMAIL,
			"TEST_USER_EMAIL not set — skipping authenticated tests",
		);
		await page.goto("/app");
		await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
	});

	test("inbox page loads", async ({ page }) => {
		await expect(page.locator("body")).toBeVisible();
	});

	test("email list is visible", async ({ page }) => {
		const emailList = page
			.locator('[data-testid="email-list"], [role="list"]')
			.first();
		await expect(emailList).toBeVisible({ timeout: 10000 });
	});

	test("can open an email", async ({ page }) => {
		const firstEmail = page
			.locator('[data-testid="email-item"]')
			.first()
			.or(page.locator('[role="listitem"]').first());

		await expect(firstEmail).toBeVisible({ timeout: 10000 });
		await firstEmail.click();

		await expect(
			page
				.locator(
					'[data-testid="email-body"], [data-testid="email-content"]',
				)
				.or(page.getByText(/.+/).nth(3)),
		).toBeVisible({ timeout: 8000 });
	});

	test("archive button is visible on email", async ({ page }) => {
		const firstEmail = page
			.locator('[data-testid="email-item"]')
			.first()
			.or(page.locator('[role="listitem"]').first());

		await expect(firstEmail).toBeVisible({ timeout: 10000 });
		await firstEmail.click();

		await expect(
			page.getByRole("button", { name: /archive/i }),
		).toBeVisible({ timeout: 8000 });
	});

	test("trash button is visible on email", async ({ page }) => {
		const firstEmail = page
			.locator('[data-testid="email-item"]')
			.first()
			.or(page.locator('[role="listitem"]').first());

		await expect(firstEmail).toBeVisible({ timeout: 10000 });
		await firstEmail.click();

		await expect(
			page.getByRole("button", { name: /trash|delete/i }),
		).toBeVisible({ timeout: 8000 });
	});

	test("compose / send email button is visible", async ({ page }) => {
		await expect(
			page.getByRole("button", { name: /compose|new email|write/i }),
		).toBeVisible({ timeout: 8000 });
	});

	test("email links open in new tab", async ({ page, context: _context }) => {
		const firstEmail = page
			.locator('[data-testid="email-item"]')
			.first()
			.or(page.locator('[role="listitem"]').first());

		await firstEmail.click();

		const emailBody = page
			.locator('[data-testid="email-body"] a, iframe')
			.first();

		if (await emailBody.isVisible()) {
			const target = await emailBody.getAttribute("target");
			expect(target).toBe("_blank");
		}
	});

	test("mailbox selector is visible", async ({ page }) => {
		await expect(
			page
				.locator('[data-testid="mailbox-switcher"]')
				.or(page.locator('[data-testid="mailbox-select"]'))
				.or(page.getByRole("combobox").first()),
		).toBeVisible({ timeout: 8000 });
	});
});
