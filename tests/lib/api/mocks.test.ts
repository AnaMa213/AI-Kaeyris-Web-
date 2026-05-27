import { describe, expect, test, vi, afterEach } from "vitest";
import createClient from "openapi-fetch";
import { ApiError } from "@/lib/api/errors";
import { audioMockMiddleware } from "@/lib/api/mocks/audio";
import { pjDeleteMockMiddleware } from "@/lib/api/mocks/pjDelete";
import { createErrorMiddleware } from "@/lib/api/problemDetails";
import type { Middleware } from "openapi-fetch";

type OnRequest = NonNullable<Middleware["onRequest"]>;
type TestAudioPaths = {
  "/services/jdr/sessions/{session_id}/audio": {
    get: {
      parameters: {
        path: {
          session_id: string;
        };
      };
      requestBody?: never;
      responses: {
        200: {
          content: {
            "audio/mp4": Blob;
          };
        };
      };
    };
  };
};

const stubMiddlewareCtx = (request: Request) =>
  ({
    request,
    schemaPath: "/stub",
    params: {},
    id: "test",
    options: {} as never,
  }) as Parameters<OnRequest>[0];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("audioMockMiddleware", () => {
  test("returns the placeholder M4A with audio/mp4 when the file exists", async () => {
    const fakeBytes = new Uint8Array([0, 1, 2, 3]).buffer;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(fakeBytes, {
          status: 200,
          headers: { "content-type": "audio/mp4" },
        }),
      ),
    );

    const request = new Request(
      "http://localhost:8000/services/jdr/sessions/abc-123/audio",
    );
    const result = (await audioMockMiddleware.onRequest!(
      stubMiddlewareCtx(request),
    )) as Response;

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toBe("audio/mp4");
  });

  test("throws an ApiError when the placeholder is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    const request = new Request(
      "http://localhost:8000/services/jdr/sessions/abc-123/audio",
    );

    await expect(
      audioMockMiddleware.onRequest!(stubMiddlewareCtx(request)),
    ).rejects.toMatchObject({
      name: "ApiError",
      problem: {
        title: "Audio mock placeholder missing",
        status: 404,
      },
    });
  });

  test("keeps the missing placeholder error contract when wired into openapi-fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );

    const client = createClient<TestAudioPaths>({
      baseUrl: "http://localhost:8000",
    });
    client.use(audioMockMiddleware);
    client.use(createErrorMiddleware());

    await expect(
      client.GET("/services/jdr/sessions/{session_id}/audio", {
        params: { path: { session_id: "abc-123" } },
        parseAs: "blob",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  test("does not match non-audio routes", async () => {
    const request = new Request(
      "http://localhost:8000/services/jdr/sessions/abc-123",
    );
    const result = await audioMockMiddleware.onRequest!(
      stubMiddlewareCtx(request),
    );
    expect(result).toBeUndefined();
  });
});

describe("pjDeleteMockMiddleware", () => {
  test("returns 204 on DELETE /services/jdr/pjs/{id}", async () => {
    const request = new Request(
      "http://localhost:8000/services/jdr/pjs/pj-42",
      { method: "DELETE" },
    );
    const result = (await pjDeleteMockMiddleware.onRequest!(
      stubMiddlewareCtx(request),
    )) as Response;
    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(204);
  });

  test("ignores GET on the same path", async () => {
    const request = new Request(
      "http://localhost:8000/services/jdr/pjs/pj-42",
      { method: "GET" },
    );
    const result = await pjDeleteMockMiddleware.onRequest!(
      stubMiddlewareCtx(request),
    );
    expect(result).toBeUndefined();
  });
});
