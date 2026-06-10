import { test, expect } from "@playwright/test";
import { createSessionState, installAuthMocks } from "../helpers/mocks";

test("direct visit to /jdr/users without a session redirects to /login (no ?from=)", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session);

  await page.goto("/jdr/users");

  await expect(page).toHaveURL("/login");
  // Story 4.11 — credentials form shown directly (no Profile Picker).
  await expect(page.getByLabel("Nom d'utilisateur")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Utilisateurs" }),
  ).not.toBeVisible();
});

test("direct visit to /jdr/campaigns without a session redirects to /login (no ?from=)", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session);

  await page.goto("/jdr/campaigns");

  await expect(page).toHaveURL("/login");
  // Story 4.11 — credentials form shown directly (no Profile Picker).
  await expect(page.getByLabel("Nom d'utilisateur")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Campagnes" }),
  ).not.toBeVisible();
});
