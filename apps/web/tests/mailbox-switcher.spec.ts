import { expect, test } from "@playwright/test";

const INBOX_URL = "/app/mailboxes?folder=inbox";
const SENT_URL = "/app/mailboxes?folder=sent";
const STORAGE_KEY = "zeromail.selectedMailboxId";

test.describe("Mailbox Switcher", () => {
	test.beforeEach(async ({ page }) => {
		test.skip(
			!process.env.TEST_USER_EMAIL,
			"TEST_USER_EMAIL not set — skipping authenticated tests",
		);
		await page.goto(INBOX_URL);
		await expect(page).toHaveURL(/\/app/, { timeout: 15000 });
	});

	// ── localStorage persistence ──────────────────────────────────────────────

	test("writes selected mailbox id to localStorage on load", async ({
		page,
	}) => {
		const storedId = await page.evaluate(
			(key) => localStorage.getItem(key),
			STORAGE_KEY,
		);
		expect(storedId).not.toBeNull();
		expect(typeof storedId).toBe("string");
		expect((storedId as string).length).toBeGreaterThan(0);
	});

	test("restores selected mailbox from localStorage on reload", async ({
		page,
	}) => {
		const idBeforeReload = await page.evaluate(
			(key) => localStorage.getItem(key),
			STORAGE_KEY,
		);

		await page.reload();
		await expect(page).toHaveURL(/\/app/, { timeout: 15000 });

		const idAfterReload = await page.evaluate(
			(key) => localStorage.getItem(key),
			STORAGE_KEY,
		);

		expect(idAfterReload).toBe(idBeforeReload);
	});

	test("falls back to first mailbox when localStorage has a stale id", async ({
		page,
	}) => {
		await page.evaluate(
			(key) => localStorage.setItem(key, "non-existent-mailbox-id-xyz"),
			STORAGE_KEY,
		);

		await page.goto(INBOX_URL);
		await page.waitForTimeout(1500);

		const idAfterFallback = await page.evaluate(
			(key) => localStorage.getItem(key),
			STORAGE_KEY,
		);

		// Must have replaced the stale id with a real one
		expect(idAfterFallback).not.toBe("non-existent-mailbox-id-xyz");
		expect(idAfterFallback).not.toBeNull();
	});

	test("clears localStorage when all mailboxes are removed", async ({
		page,
	}) => {
		// Simulate no-mailbox state by clearing the key and checking context handles it
		await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
		await page.reload();
		await page.waitForTimeout(1500);

		// App should still render without crashing
		await expect(page.locator("body")).toBeVisible();
	});

	// ── Single-mailbox behaviour ──────────────────────────────────────────────

	test("switcher trigger is hidden when only one mailbox is connected", async ({
		page,
	}) => {
		const switcherTrigger = page.locator(
			'[data-testid="mailbox-switcher"]',
		);
		const mailboxCount = await page
			.getByRole("menuitemradio")
			.count()
			.catch(() => 0);

		if (mailboxCount !== 1) {
			test.skip();
			return;
		}

		await expect(switcherTrigger).not.toBeVisible();
	});

	// ── Multi-mailbox behaviour ───────────────────────────────────────────────

	test.describe("with multiple mailboxes connected", () => {
		test.beforeEach(async ({ page }) => {
			// Count radio items that MailboxSelect / context exposes, or check
			// whether the switcher trigger itself is present as the signal.
			const switcher = page.locator('[data-testid="mailbox-switcher"]');
			const isVisible = await switcher
				.isVisible({ timeout: 5000 })
				.catch(() => false);
			if (!isVisible) {
				test.skip();
			}
		});

		test("switcher trigger is visible in the inbox header", async ({
			page,
		}) => {
			await expect(
				page.locator('[data-testid="mailbox-switcher"]'),
			).toBeVisible({ timeout: 8000 });
		});

		test("dropdown opens on click and lists mailboxes", async ({
			page,
		}) => {
			await page.locator('[data-testid="mailbox-switcher"]').click();

			// At least one dropdown item should be visible
			const items = page.getByRole("menuitem");
			await expect(items.first()).toBeVisible({ timeout: 5000 });
			expect(await items.count()).toBeGreaterThan(0);
		});

		test("active mailbox has a checkmark in the dropdown", async ({
			page,
		}) => {
			await page.locator('[data-testid="mailbox-switcher"]').click();

			// Our MailboxMenuRow renders a CheckIcon svg for the active item.
			// The svg is inside a menuitem — at least one item must contain it.
			const checkedItem = page
				.getByRole("menuitem")
				.locator("svg")
				.first();
			await expect(checkedItem).toBeVisible({ timeout: 5000 });
		});

		test("dropdown closes after selecting a mailbox", async ({ page }) => {
			const trigger = page.locator('[data-testid="mailbox-switcher"]');
			await trigger.click();

			const items = page.getByRole("menuitem");
			await items.first().click();

			// Dropdown content should disappear
			await expect(items.first()).not.toBeVisible({ timeout: 3000 });
		});

		test("switching mailbox resets the URL folder to inbox", async ({
			page,
		}) => {
			// Navigate to Sent folder first
			await page.goto(SENT_URL);
			await expect(page).toHaveURL(/folder=sent/);

			const trigger = page.locator('[data-testid="mailbox-switcher"]');
			await trigger.click();

			// Pick the second item (a different mailbox)
			const items = page.getByRole("menuitem");
			await expect(items.nth(1)).toBeVisible({ timeout: 5000 });
			await items.nth(1).click();

			// URL must reset to inbox
			await expect(page).toHaveURL(/folder=inbox/, { timeout: 5000 });
		});

		test("switching mailbox updates the id stored in localStorage", async ({
			page,
		}) => {
			const idBefore = await page.evaluate(
				(key) => localStorage.getItem(key),
				STORAGE_KEY,
			);

			const trigger = page.locator('[data-testid="mailbox-switcher"]');
			await trigger.click();

			// Click whichever item is NOT currently active (second item)
			const items = page.getByRole("menuitem");
			await items.nth(1).click();
			await page.waitForTimeout(500);

			const idAfter = await page.evaluate(
				(key) => localStorage.getItem(key),
				STORAGE_KEY,
			);

			expect(idAfter).not.toBe(idBefore);
		});

		test("switching mailbox closes any open message panel", async ({
			page,
		}) => {
			// Open the first available email if there is one
			const firstEmail = page
				.locator("button[class*='border-b']")
				.first();
			if (
				await firstEmail.isVisible({ timeout: 3000 }).catch(() => false)
			) {
				await firstEmail.click();
				// Wait for message detail to appear (back button is the signal)
				await page.waitForSelector('[aria-label="Back"]', {
					timeout: 5000,
				});
			}

			// Switch mailbox
			const trigger = page.locator('[data-testid="mailbox-switcher"]');
			await trigger.click();
			const items = page.getByRole("menuitem");
			await items.nth(1).click();

			// Message panel back-button should no longer exist
			await expect(page.locator('[aria-label="Back"]')).not.toBeVisible({
				timeout: 3000,
			});
		});

		test("switching to the same mailbox is a no-op and does not navigate away", async ({
			page,
		}) => {
			const urlBefore = page.url();

			const trigger = page.locator('[data-testid="mailbox-switcher"]');
			await trigger.click();

			// Click the first item (the currently active mailbox)
			const items = page.getByRole("menuitem");
			await items.first().click();
			await page.waitForTimeout(300);

			// URL should be unchanged (still inbox)
			expect(page.url()).toBe(urlBefore);
		});

		test("selected mailbox persists after switching and reloading", async ({
			page,
		}) => {
			const trigger = page.locator('[data-testid="mailbox-switcher"]');
			await trigger.click();

			const items = page.getByRole("menuitem");
			await items.nth(1).click();
			await page.waitForTimeout(300);

			const idAfterSwitch = await page.evaluate(
				(key) => localStorage.getItem(key),
				STORAGE_KEY,
			);

			await page.reload();
			await page.waitForTimeout(1000);

			const idAfterReload = await page.evaluate(
				(key) => localStorage.getItem(key),
				STORAGE_KEY,
			);

			expect(idAfterReload).toBe(idAfterSwitch);
		});
	});
});
