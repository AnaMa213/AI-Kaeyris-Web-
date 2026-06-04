import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import {
  createSessionState,
  installAuthMocks,
} from "../helpers/mocks";

const campId = "11111111-1111-1111-1111-111111111111";
const campaign = {
  id: campId,
  name: "Les Royaumes Brisés",
  description: "Un royaume autrefois uni se déchire.",
  role: "gm" as const,
  session_count: 2,
  last_session_at: "2026-05-30T20:00:00+00:00",
  created_at: "2026-01-12T18:00:00+00:00",
};

const session12 = {
  id: "ses-12",
  title: "Session 12 — La cité engloutie",
  recorded_at: "2026-05-30T20:00:00+00:00",
  mode: "batch",
  state: "created",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-30T20:00:00+00:00",
  updated_at: "2026-05-30T20:00:00+00:00",
};

const session11 = {
  id: "ses-11",
  title: "Session 11 — Le pacte rompu",
  recorded_at: "2026-05-24T20:00:00+00:00",
  mode: "batch",
  state: "transcribed",
  transcription_mode: "non_diarised",
  campaign_context: null,
  created_at: "2026-05-24T20:00:00+00:00",
  updated_at: "2026-05-24T20:00:00+00:00",
};

async function mockCampaignDetail(page: Page) {
  await page.route(
    `**/services/jdr/campaigns/${campId}`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(campaign),
        });
        return;
      }
      await route.continue();
    },
  );
}

async function mockSessionsList(
  page: Page,
  sessions: typeof session12[],
) {
  await page.route("**/services/jdr/sessions**", async (route) => {
    const url = route.request().url();
    if (
      route.request().method() === "GET" &&
      url.includes(`campaign_id=${campId}`)
    ) {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          items: sessions,
          total: sessions.length,
          page: 1,
          size: 50,
        }),
      });
      return;
    }
    await route.continue();
  });
}

test("GM lands on campaign detail and sees the sessions list scoped to this campaign", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page);
  await mockSessionsList(page, [session11, session12]);
  // Story 2.10 mounts <CampaignPjsCard> which fetches /pjs?campaign_id=… ;
  // we stub an empty roster so the side card renders without an error banner.
  await page.route(/\/services\/jdr\/pjs(\?|$)/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [], total: 0 }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(`/jdr/campaigns/${campId}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Les Royaumes Brisés" }),
  ).toBeVisible();
  await expect(
    page.getByText("Un royaume autrefois uni se déchire."),
  ).toBeVisible();

  // Sessions list ordered desc.
  const titles = await page.getByRole("heading", { level: 3 }).all();
  expect(titles.length).toBe(2);
  await expect(titles[0]).toHaveText(/Session 12/);
  await expect(titles[1]).toHaveText(/Session 11/);

  // <CampaignPjsCard> is mounted (Story 2.10 replaced the placeholder).
  await expect(
    page.getByRole("heading", { level: 2, name: "PJs" }),
  ).toBeVisible();
});

test("GM navigates from campaign detail into a session detail via row click", async ({
  page,
}) => {
  const session = createSessionState("authenticated");
  await installAuthMocks(page, session);
  await mockCampaignDetail(page);
  await mockSessionsList(page, [session12]);
  await page.route(
    `**/services/jdr/sessions/${session12.id}`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "content-type": "application/json" },
          body: JSON.stringify(session12),
        });
        return;
      }
      await route.continue();
    },
  );

  await page.goto(`/jdr/campaigns/${campId}`);
  await page.getByRole("link", { name: /Session 12/ }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `/jdr/campaigns/${campId}/sessions/${session12.id}\\?tab=transcription$`,
    ),
  );
  await expect(
    page.getByRole("link", { name: /Les Royaumes Brisés/ }),
  ).toBeVisible();
});
