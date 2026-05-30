import type { Middleware } from "openapi-fetch";
import { ApiError, type ProblemDetails } from "@/lib/core/api/errors";

const AUDIO_PATH = /^\/services\/jdr\/sessions\/[^/]+\/audio$/;
const PLACEHOLDER_ASSET = "/mocks/demo-session.m4a";

function missingPlaceholderProblem(): ProblemDetails {
  return {
    type: "about:blank",
    title: "Audio mock placeholder missing",
    status: 404,
    detail: `Drop a demo audio file at public${PLACEHOLDER_ASSET}. See public/mocks/README.md.`,
  };
}

export const audioMockMiddleware: Middleware = {
  async onRequest({ request }) {
    if (request.method !== "GET") return undefined;
    const { pathname } = new URL(request.url);
    if (!AUDIO_PATH.test(pathname)) return undefined;

    const placeholder = await fetch(PLACEHOLDER_ASSET);
    if (placeholder.status === 404) {
      throw new ApiError(missingPlaceholderProblem());
    }

    const body = await placeholder.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: { "content-type": "audio/mp4" },
    });
  },
};
