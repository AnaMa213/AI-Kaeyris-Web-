import type { Middleware } from "openapi-fetch";

const AUDIO_PATH = /^\/services\/jdr\/sessions\/[^/]+\/audio$/;
const PLACEHOLDER_ASSET = "/mocks/demo-session.m4a";

function missingPlaceholderResponse(): Response {
  return new Response(
    JSON.stringify({
      type: "about:blank",
      title: "Audio mock placeholder missing",
      status: 404,
      detail: `Drop a demo audio file at public${PLACEHOLDER_ASSET}. See public/mocks/README.md.`,
    }),
    {
      status: 404,
      headers: { "content-type": "application/problem+json" },
    },
  );
}

export const audioMockMiddleware: Middleware = {
  async onRequest({ request }) {
    if (request.method !== "GET") return undefined;
    const { pathname } = new URL(request.url);
    if (!AUDIO_PATH.test(pathname)) return undefined;

    const placeholder = await fetch(PLACEHOLDER_ASSET);
    if (placeholder.status === 404) {
      return missingPlaceholderResponse();
    }

    const body = await placeholder.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: { "content-type": "audio/mp4" },
    });
  },
};
