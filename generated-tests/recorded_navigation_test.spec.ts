import { test, expect } from '@playwright/test';

test('Recorded Navigation Test', async ({ page }) => {
  // ── Navigation ──
  await page.goto('https://demo.playwright.dev/todomvc/');

  // ── Assertions for: https://demo.playwright.dev/todomvc/#/ ──
  await expect(page.getByRole("link", { name: "real TodoMVC app." })).toBeVisible(); // "real TodoMVC app."
  await expect(page.getByRole("textbox", { name: "What needs to be done?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Remo H. Jansen" })).toBeVisible(); // "Remo H. Jansen"
  await expect(page.getByRole("link", { name: "TodoMVC" })).toBeVisible(); // "TodoMVC"

  // ── Assertions for: https://www.amazon.com/ ──
  await expect(page.getByRole("button", { name: "Continue shopping" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conditions of Use" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toBeVisible();
  await expect(page.getByRole("link", { name: /main content/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Search/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Cart/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Home/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Your orders/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /shortcuts/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Amazon", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Deliver to/i })).toBeVisible();
  await expect(page.getByRole("combobox", { name: /All Departments/i })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search Amazon" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Choose a language/i })).toBeVisible();

});
