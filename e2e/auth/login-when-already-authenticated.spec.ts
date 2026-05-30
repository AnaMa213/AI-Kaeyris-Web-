import { test, expect } from "@playwright/test";
import { createSessionState, installAuthMocks } from "../helpers/mocks";

test("already-authenticated user visiting /login is redirected to /jdr/sessions", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);

  await page.goto("/login");

  await expect(page).toHaveURL(/\/jdr\/sessions/);
  await expect(page.getByText("Aucune session encore.")).toBeVisible();
  await expect(page.getByText("MJ", { exact: true })).not.toBeVisible();
});

test("already-authenticated user visiting /login?from=/jdr/users still lands on /jdr/sessions (the from is ignored)", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);

  await page.goto("/login?from=%2Fjdr%2Fusers");

  await expect(page).toHaveURL(/\/jdr\/sessions/);
  await expect(page.getByText("Aucune session encore.")).toBeVisible();
});
