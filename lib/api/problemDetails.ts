import type { Middleware } from "openapi-fetch";
import {
  ApiError,
  AuthError,
  type ProblemDetails,
} from "@/lib/api/errors";

const PROBLEM_CONTENT_TYPE = "application/problem+json";

export function isProblemContentType(contentType: string | null): boolean {
  if (contentType === null) return false;
  return contentType.trim().toLowerCase().startsWith(PROBLEM_CONTENT_TYPE);
}

function fallbackProblem(response: Response): ProblemDetails {
  return {
    type: "about:blank",
    title: response.statusText || "Request failed",
    status: response.status,
  };
}

function isProblemShape(value: unknown): value is Partial<ProblemDetails> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value)
  );
}

export async function parseProblemDetails(
  response: Response,
): Promise<ProblemDetails> {
  const contentType = response.headers.get("content-type");
  if (!isProblemContentType(contentType)) {
    return fallbackProblem(response);
  }

  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return fallbackProblem(response);
  }

  if (!isProblemShape(body)) {
    return fallbackProblem(response);
  }

  return {
    type: typeof body.type === "string" ? body.type : "about:blank",
    title:
      typeof body.title === "string"
        ? body.title
        : response.statusText || "Request failed",
    status: typeof body.status === "number" ? body.status : response.status,
    ...body,
  };
}

export function createErrorMiddleware(): Middleware {
  return {
    async onResponse({ response }) {
      if (response.status < 400) return undefined;
      const problem = await parseProblemDetails(response);
      if (response.status === 401) {
        throw new AuthError(problem);
      }
      throw new ApiError(problem);
    },
  };
}
