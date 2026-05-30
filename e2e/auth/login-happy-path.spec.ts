import { test, expect } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
  loginAsGM,
} from "../helpers/mocks";

test("GM logs in via /login and lands on /jdr/sessions with sidebar visible", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session);

  await page.goto("/login");
  await expect(page.getByText("MJ", { exact: true })).toBeVisible();

  await loginAsGM(page);

  await expect(page).toHaveURL(/\/jdr\/sessions/);
  await expect(
    page.getByText("AI-Kaeyris", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("JDR Assistant")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Sessions" }),
  ).toBeVisible();
  await expect(page.getByText("Aucune session encore.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Sessions/i }),
  ).toHaveAttribute("aria-current", "page");
});
