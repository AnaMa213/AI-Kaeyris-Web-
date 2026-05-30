import { describe, expect, test } from "vitest";
import {
  isProblemContentType,
  parseProblemDetails,
} from "@/lib/core/api/problemDetails";

describe("isProblemContentType", () => {
  test("accepts application/problem+json with parameters", () => {
    expect(isProblemContentType("application/problem+json; charset=utf-8")).toBe(
      true,
    );
  });

  test("rejects plain application/json", () => {
    expect(isProblemContentType("application/json")).toBe(false);
  });

  test("rejects null", () => {
    expect(isProblemContentType(null)).toBe(false);
  });
});

describe("parseProblemDetails", () => {
  test("returns the full problem object on a valid problem+json body", async () => {
    const body = {
      type: "https://example.com/errors/invalid",
      title: "Invalid input",
      status: 400,
      detail: "Missing field 'foo'",
      instance: "/api/foos/123",
    };
    const response = new Response(JSON.stringify(body), {
      status: 400,
      headers: { "content-type": "application/problem+json" },
    });
    const problem = await parseProblemDetails(response);
    expect(problem.type).toBe(body.type);
    expect(problem.title).toBe(body.title);
    expect(problem.status).toBe(400);
    expect(problem.detail).toBe(body.detail);
    expect(problem.instance).toBe(body.instance);
  });

  test("synthesises a fallback when content-type is plain application/json", async () => {
    const response = new Response("{}", {
      status: 500,
      statusText: "Internal Server Error",
      headers: { "content-type": "application/json" },
    });
    const problem = await parseProblemDetails(response);
    expect(problem.type).toBe("about:blank");
    expect(problem.status).toBe(500);
    expect(problem.title).toBe("Internal Server Error");
  });

  test("synthesises a fallback when problem+json body is malformed", async () => {
    const response = new Response("<not-json>", {
      status: 400,
      statusText: "Bad Request",
      headers: { "content-type": "application/problem+json" },
    });
    const problem = await parseProblemDetails(response);
    expect(problem.type).toBe("about:blank");
    expect(problem.status).toBe(400);
    expect(problem.title).toBe("Bad Request");
  });

  test("normalises invalid required fields while preserving extensions", async () => {
    const response = new Response(
      JSON.stringify({
        type: 123,
        title: false,
        status: "404",
        detail: "The backend sent invalid problem fields.",
      }),
      {
        status: 404,
        statusText: "Not Found",
        headers: { "content-type": "application/problem+json" },
      },
    );

    const problem = await parseProblemDetails(response);

    expect(problem.type).toBe("about:blank");
    expect(problem.title).toBe("Not Found");
    expect(problem.status).toBe(404);
    expect(problem.detail).toBe("The backend sent invalid problem fields.");
  });
});
