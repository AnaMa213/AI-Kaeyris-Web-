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

const AUTH_ME_BODY = JSON.stringify({
  user: { id: "kenan-uuid", username: "kenan", system_role: "admin" },
  active_campaign: {
    id: "campaign-default-uuid",
    name: "Campagne par défaut",
    role: "gm",
    character_id: "kenan-pc-uuid",
  },
});

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
 * Required for /login to show the credentials form (not the SetupWizard).
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
 * GET /services/jdr/auth/me — the real endpoint that lands with BD-4.
 * Returns 200 with the Kenan-MJ payload or 401 based on sessionState.
 */
export async function mockSessionProbe(
  page: Page,
  sessionState: SessionState,
) {
  await page.route("**/services/jdr/auth/me", async (route) => {
    if (sessionState.isAuthenticated()) {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: AUTH_ME_BODY,
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

/**
 * GET /services/jdr/users returns an empty list when authenticated, 401
 * otherwise. The /jdr/users page calls this on mount; the empty-list 200
 * keeps the page renderable in tests that visit it as an authenticated GM.
 */
export async function mockUsersList(page: Page, sessionState: SessionState) {
  await page.route("**/services/jdr/users", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (sessionState.isAuthenticated()) {
      await route.fulfill({
        status: 200,
        headers: JSON_HEADERS,
        body: JSON.stringify({ items: [] }),
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

interface CampaignFixture {
  id: string;
  name: string;
  description: string | null;
  role: "gm" | "pj";
  session_count: number;
  last_session_at: string | null;
  created_at: string;
}

/**
 * GET /services/jdr/campaigns returns a paginated CampaignOut list.
 * Story 2.4 onwards: /jdr/campaigns calls this on mount.
 */
export async function mockCampaignsList(
  page: Page,
  campaigns: CampaignFixture[],
) {
  await page.route("**/services/jdr/campaigns", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      headers: JSON_HEADERS,
      body: JSON.stringify({
        items: campaigns,
        total: campaigns.length,
        page: 1,
        size: 50,
      }),
    });
  });
}

/**
 * POST /services/jdr/campaigns returns 201 with the provided CampaignOut.
 * Used by Story 2.4 create flow.
 */
export async function mockCampaignCreate(
  page: Page,
  response: CampaignFixture,
) {
  await page.route("**/services/jdr/campaigns", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 201,
      headers: JSON_HEADERS,
      body: JSON.stringify(response),
    });
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
 * Convenience: install setup-status, /auth/me probe, /users list, login,
 * and logout mocks at once, all wired to the same session state.
 */
export async function installAuthMocks(
  page: Page,
  sessionState: SessionState,
  opts: { loginDelayMs?: number; logoutDelayMs?: number } = {},
) {
  await mockSetupStatusNotRequired(page);
  await mockSessionProbe(page, sessionState);
  await mockUsersList(page, sessionState);
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
 * Drive the single credentials login form (Story 4.11 — no Profile Picker):
 * fills credentials and submits.
 */
export async function loginAsGM(
  page: Page,
  credentials: { username: string; password: string } = {
    username: "kenan",
    password: "test1234",
  },
) {
  await page.getByLabel("Nom d'utilisateur").fill(credentials.username);
  await page.getByLabel("Mot de passe").fill(credentials.password);
  await page.getByRole("button", { name: "Se connecter" }).click();
}
