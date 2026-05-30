import type { Middleware } from "openapi-fetch";

const PJ_PATH = /^\/services\/jdr\/pjs\/[^/]+$/;

export const pjDeleteMockMiddleware: Middleware = {
  onRequest({ request }) {
    if (request.method !== "DELETE") return undefined;
    const { pathname } = new URL(request.url);
    if (!PJ_PATH.test(pathname)) return undefined;
    return new Response(null, { status: 204 });
  },
};
