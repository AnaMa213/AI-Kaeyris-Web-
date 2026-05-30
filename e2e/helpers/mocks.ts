import type { Page } from "@playwright/test";

const SESSION_COOKIE =
  "kaeyris_session=mock-session-cookie; Path=/; HttpOnly; SameSite=Lax";
const CLEAR_COOKIE =
  "kaeyris_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax";

const PROBLEM_HEADERS = { "content-type": "application/problem+json" };
const JSON_HEADERS = { "content-type": "application/json" };

const UNAUTH_BODY = JSON.stringify({
  type: "about:blank",
  title: "Unauthorized",
  status: 401,
});

const EMPTY_USERS_BODY = JSON.stringify({ items: [] });

/**
 * Mutable session state shared between probe and login/logout mocks.
 * Lets a single test exercise multi-step flows (login -> logout -> re-login).
 */
export interface SessionState {
  setAuthenticated(): void;
  setUnauthenticated(): void;
  isAuthenticated(): boolean;
}

export function createSessionState(
  initial: "authenticated" | "unauthenticated" = "unauthenticated",
): SessionState {
  let state = initial;
  return {
    setAuthenticated() {
      state = "authenticated";
    },
    setUnauthenticated() {
      state = "unauthenticated";
    },
    isAuthenticated() {
      return state === "authenticated";
    },
  };
}

/**
 * GET /services/jdr/auth/setup/status replies {required: false}.
 * Required for /login to show the ProfilePicker (not the SetupWizard).
 */
export async function mockSetupStatusNotRequired(page: Page) {
  await page.route(
    "**/services/jdr/auth/setup/status",
    async (route) => {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({ required: false }),
      });
    },
  );
}

/**
 * V1 transitional probe: GET /services/jdr/users used by useCurrentUser
 * to validate the session cookie. Returns 200 or 401 based on sessionState.
 */
export async function mockSessionProbe(
  page: Page,
  sessionState: SessionState,
) {
  await page.route("**/services/jdr/users", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (sessionState.isAuthenticated()) {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: EMPTY_USERS_BODY,
      });
    } else {
      await route.fulfill({
        status: 401,
        headers: PROBLEM_HEADERS,
        body: UNAUTH_BODY,
      });
    }
  });
}

interface MockLoginOptions {
  delayMs?: number;
  sessionState?: SessionState;
}

/**
 * POST /services/jdr/auth/login returns 204 + sets a mock session cookie.
 * If sessionState is provided, flips it to authenticated on success.
 */
export async function mockLoginSucceeds(
  page: Page,
  options: MockLoginOptions = {},
) {
  const { delayMs = 0, sessionState } = options;
  await page.route("**/services/jdr/auth/login", async (route) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    sessionState?.setAuthenticated();
    await route.fulfill({
      status: 204,
      headers: { "set-cookie": SESSION_COOKIE },
    });
  });
}

interface MockLogoutOptions {
  delayMs?: number;
  sessionState?: SessionState;
}

/**
 * POST /services/jdr/auth/logout returns 204 + clears the session cookie.
 * The delayMs option simulates a slow backend so race-condition tests
 * (Story 1.12 fix f74db81) have a realistic window to exercise.
 * If sessionState is provided, flips it to unauthenticated on success.
 */
export async function mockLogoutSucceeds(
  page: Page,
  options: MockLogoutOptions = {},
) {
  const { delayMs = 0, sessionState } = options;
  await page.route("**/services/jdr/auth/logout", async (route) => {
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    sessionState?.setUnauthenticated();
    await route.fulfill({
      status: 204,
      headers: { "set-cookie": CLEAR_COOKIE },
    });
  });
}

/**
 * Convenience: install setup-status, session probe, login, and logout
 * mocks at once, all wired to the same session state.
 */
export async function installAuthMocks(
  page: Page,
  sessionState: SessionState,
  opts: { loginDelayMs?: number; logoutDelayMs?: number } = {},
) {
  await mockSetupStatusNotRequired(page);
  await mockSessionProbe(page, sessionState);
  await mockLoginSucceeds(page, {
    sessionState,
    delayMs: opts.loginDelayMs,
  });
  await mockLogoutSucceeds(page, {
    sessionState,
    delayMs: opts.logoutDelayMs,
  });
}

/**
 * Drive the ProfilePicker login form. Picks MJ, fills credentials, submits.
 */
export async function loginAsGM(
  page: Page,
  credentials: { username: string; password: string } = {
    username: "kenan",
    password: "test1234",
  },
) {
  await page.getByText("MJ", { exact: true }).click();
  await page.getByLabel("Nom d'utilisateur").fill(credentials.username);
  await page.getByLabel("Mot de passe").fill(credentials.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}
