// Real-service smoke check. Start Django/Vite or set HOS_TEST_URL to a deployment.
import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.HOS_BROWSER_PATH || undefined,
});
try {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.HOS_TEST_URL || "http://127.0.0.1:5173");
  await page.getByRole("button", { name: "Generate trip plan" }).click();
  await page.locator(".timeline").waitFor();
  await expect(
    page.getByRole("button", { name: "Daily log sheets 2", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export logs" }).click();
  const download = await downloadPromise;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toMatch(/^HOS-logs-.*\.pdf$/);
  await download.saveAs("artifacts/browser-logs.pdf");
  await page
    .getByRole("button", { name: "Daily log sheets 2", exact: true })
    .click();
  await page.getByRole("button", { name: /DAY 2/ }).click();
  await expect(page.locator(".log-graph")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "artifacts/browser-mobile.png",
    fullPage: true,
  });
  await page
    .getByLabel("Current location", { exact: true })
    .fill("Atlanta, Georgia");
  await page
    .getByRole("button", { name: "Search current location", exact: true })
    .click();
  await page.locator(".search-results button").first().waitFor();
  await page.locator(".search-results button").first().click();
  await page.getByLabel("Current cycle used 70 hrs max").fill("69");
  await page.getByRole("button", { name: "Generate trip plan" }).click();
  await page.locator(".timeline").waitFor();
  await expect(
    page
      .locator(".timeline")
      .getByText("34-hour cycle restart", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    "PASS: real route, daily logs, PDF download, mobile layout, geocoding, cycle restart, no page errors.",
  );
} finally {
  await browser.close();
}
