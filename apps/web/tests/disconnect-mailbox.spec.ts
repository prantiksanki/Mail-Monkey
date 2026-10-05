import { expect, test } from "@playwright/test";

/**
 * E2E tests for the disconnect Gmail mailbox flow.
 *
 * Prerequisites: These tests require an authenticated user with a connected
 * Gmail mailbox. An auth setup file (e.g. auth.setup.ts) with session storage
 * state is needed before these tests can run against a real environment.
 *
 * For now, these tests document the expected behavior and can be run once
 * auth fixtures are in place.
 */

test.describe
	.skip("disconnect Gmail mailbox", () => {
		test.describe("from MailboxSelect dropdown", () => {
			test("shows disconnect button on hover and opens confirmation dialog", async ({
				page,
			}) => {
				await page.goto("/app");

				// Open mailbox dropdown
				const mailboxTrigger = page.locator(
					'[data-testid="mailbox-select"]',
				);
				await mailboxTrigger.click();

				// Hover over a mailbox item to reveal disconnect button
				const mailboxItem = page.getByRole("menuitemradio").first();
				await mailboxItem.hover();

				// Click the disconnect icon
				const disconnectButton = mailboxItem.locator("button");
				await disconnectButton.click();

				// Confirmation dialog should appear
				const dialog = page.getByRole("alertdialog");
				await expect(dialog).toBeVisible();
				await expect(dialog.getByText("Disconnect")).toBeVisible();
				await expect(
					dialog.getByText(
						"All rules and execution history for this mailbox will be permanently deleted",
					),
				).toBeVisible();
			});

			test("cancelling disconnect does not remove mailbox", async ({
				page,
			}) => {
				await page.goto("/app");

				const mailboxTrigger = page.locator(
					'[data-testid="mailbox-select"]',
				);
				await mailboxTrigger.click();

				const mailboxItem = page.getByRole("menuitemradio").first();
				await mailboxItem.hover();

				const disconnectButton = mailboxItem.locator("button");
				await disconnectButton.click();

				// Click Cancel
				const dialog = page.getByRole("alertdialog");
				await dialog.getByRole("button", { name: "Cancel" }).click();

				// Dialog should close
				await expect(dialog).not.toBeVisible();

				// Mailbox should still be in the dropdown
				await mailboxTrigger.click();
				await expect(
					page.getByRole("menuitemradio").first(),
				).toBeVisible();
			});

			test("confirming disconnect removes mailbox and updates UI", async ({
				page,
			}) => {
				// This test requires the user to have multiple mailboxes
				// (disconnect is blocked when only one mailbox exists)
				await page.goto("/app");

				const mailboxTrigger = page.locator(
					'[data-testid="mailbox-select"]',
				);
				await mailboxTrigger.click();

				// Count mailboxes before disconnect
				const mailboxCount = await page
					.getByRole("menuitemradio")
					.count();

				// Skip if only one mailbox — disconnect button won't be shown
				if (mailboxCount <= 1) {
					test.skip();
					return;
				}

				const mailboxItem = page.getByRole("menuitemradio").first();
				await mailboxItem.hover();

				const disconnectButton = mailboxItem.locator("button");
				await disconnectButton.click();

				// Confirm disconnect
				const dialog = page.getByRole("alertdialog");
				await dialog
					.getByRole("button", { name: "Disconnect" })
					.click();

				// Wait for success toast
				await expect(
					page.getByText("has been disconnected"),
				).toBeVisible();

				// Mailbox count should decrease
				await mailboxTrigger.click();
				const newCount = await page.getByRole("menuitemradio").count();
				expect(newCount).toBe(mailboxCount - 1);
			});
		});

		test.describe("from security settings", () => {
			test("shows disconnect button for connected Google account", async ({
				page,
			}) => {
				await page.goto("/app/settings/security");

				// Google should show connected with disconnect option
				const googleRow = page
					.locator("div")
					.filter({ hasText: "Google" })
					.first();
				await expect(
					googleRow.getByRole("button", { name: "Disconnect" }),
				).toBeVisible();
			});

			test("disconnect from settings opens confirmation dialog", async ({
				page,
			}) => {
				await page.goto("/app/settings/security");

				const disconnectButton = page.getByRole("button", {
					name: "Disconnect",
				});
				await disconnectButton.click();

				const dialog = page.getByRole("alertdialog");
				await expect(dialog).toBeVisible();
			});
		});

		test.describe("single mailbox guard", () => {
			test("hides disconnect button when only one mailbox connected", async ({
				page,
			}) => {
				await page.goto("/app");

				const mailboxTrigger = page.locator(
					'[data-testid="mailbox-select"]',
				);
				await mailboxTrigger.click();

				const mailboxCount = await page
					.getByRole("menuitemradio")
					.count();

				if (mailboxCount !== 1) {
					test.skip();
					return;
				}

				// Hover over the only mailbox
				const mailboxItem = page.getByRole("menuitemradio").first();
				await mailboxItem.hover();

				// Disconnect button should NOT be visible
				const disconnectButton = mailboxItem.locator("button");
				await expect(disconnectButton).not.toBeVisible();
			});
		});
	});
