import { test, expect } from "@playwright/test";
import { createSessionState, installAuthMocks } from "../helpers/mocks";

test("direct visit to /jdr/users without a session redirects to /login?from=...", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session);

  await page.goto("/jdr/users");

  await expect(page).toHaveURL("/login?from=%2Fjdr%2Fusers");
  await expect(page.getByText("MJ", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Utilisateurs" }),
  ).not.toBeVisible();
});

test("direct visit to /jdr/sessions without a session redirects to /login?from=...", async ({
  page,
}) => {
  const session = createSessionState("unauthenticated");
  await installAuthMocks(page, session);

  await page.goto("/jdr/sessions");

  await expect(page).toHaveURL("/login?from=%2Fjdr%2Fsessions");
  await expect(page.getByText("MJ", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Sessions" }),
  ).not.toBeVisible();
});
