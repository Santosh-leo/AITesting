import { test, expect } from '@playwright/test';

test('Recorded Navigation Test', async ({ page }) => {
  // ── Navigation ──
  await page.goto('https://demo.playwright.dev/todomvc/');

  // ── Assertions for: https://demo.playwright.dev/todomvc/#/ ──
  await expect(page.getByRole("link", { name: "real TodoMVC app." })).toBeVisible(); // "real TodoMVC app."
  await expect(page.getByRole("textbox", { name: "What needs to be done?" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Remo H. Jansen" })).toBeVisible(); // "Remo H. Jansen"
  await expect(page.getByRole("link", { name: "TodoMVC" })).toBeVisible(); // "TodoMVC"

});
