import { expect, test } from "@playwright/test";

test.describe("Oman Air Digital Retailing Engine E2E", () => {
  test("renders lightweight static CDN Dark Site page independently", async ({ page }) => {
    await page.goto("/dark-site.html");
    await expect(page.getByText("OMAN AIR · CRISIS INFORMATION CENTRE")).toBeVisible();
    await expect(page.getByText("WY603")).toBeVisible();
    await page.getByRole("button", { name: "العربية" }).click();
    await expect(page.getByText("تنبيه تشغيلي عاجل")).toBeVisible();
  });

  test("authenticates OIDC PKCE Admin + RFC 6238 TOTP MFA and opens Back Office", async ({
    page,
  }) => {
    await page.goto("/admin");
    await expect(page.getByText("Headless CMS, Rules & Dark Site Back Office")).toBeVisible();

    const authBtn = page.getByRole("button", { name: /Authenticate via OIDC PKCE/i });
    await expect(authBtn).toBeVisible({ timeout: 10_000 });
    await authBtn.click();

    await expect(page.getByText("RFC 6238 TOTP MFA Gate")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Enroll \/ Get Code/i }).click();
    await page.getByRole("button", { name: /Verify MFA/i }).click();
    await expect(page.getByText("VERIFIED", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("OpenTelemetry HTTP Traces")).toBeVisible();
  });

  test("executes search -> checkout with Hosted 3DS2 card challenge", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/BFF Active/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /One-Way/i }).click();
    await page.getByRole("button", { name: /Search Flights/i }).click();

    // Step 1: Fares -> Seats & Bundles
    const toSeatsBtn = page.getByRole("button", { name: /Continue to Seats & Bundles/i });
    await expect(toSeatsBtn).toBeVisible({ timeout: 10_000 });
    await toSeatsBtn.click();

    // Step 2: Travel protection choice -> Passengers
    await page.getByRole("button", { name: /No, I Decline Protection/i }).click();
    await page.getByRole("button", { name: /Continue to Passengers/i }).click();

    // Step 3: Demo OCR fill -> Review & Pay
    await page
      .getByRole("button", { name: /Demo Scan Fill/i })
      .first()
      .click();
    await page.getByRole("button", { name: /^Review & Pay/i }).click();

    // Step 4: Hosted card tokenization + EMV 3DS2 OTP challenge -> Confirm
    await page.getByRole("button", { name: /Complete Demo Booking/i }).click();
    const verify3ds = page.getByRole("button", { name: /Verify 3DS2 & Issue Ticket/i });
    await expect(verify3ds).toBeVisible({ timeout: 10_000 });
    await verify3ds.click();

    await expect(page.getByRole("heading", { name: /Booking Confirmed!/i })).toBeVisible({
      timeout: 10_000,
    });
  });
});
