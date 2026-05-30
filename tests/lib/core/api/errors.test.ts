import { describe, expect, test } from "vitest";
import {
  ApiError,
  AuthError,
  NetworkError,
  type ProblemDetails,
} from "@/lib/core/api/errors";

const sampleProblem: ProblemDetails = {
  type: "https://example.com/errors/invalid",
  title: "Invalid input",
  status: 400,
  detail: "The 'foo' field is required.",
};

describe("ApiError", () => {
  test("wraps a ProblemDetails and exposes title as message", () => {
    const err = new ApiError(sampleProblem);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.problem).toEqual(sampleProblem);
    expect(err.message).toBe(sampleProblem.title);
    expect(err.name).toBe("ApiError");
  });
});

describe("AuthError", () => {
  test("extends ApiError and Error and carries the problem payload", () => {
    const err = new AuthError({ ...sampleProblem, status: 401 });
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.name).toBe("AuthError");
    expect(err.problem.status).toBe(401);
  });
});

describe("NetworkError", () => {
  test("extends Error and propagates the cause when provided", () => {
    const cause = new TypeError("Failed to fetch");
    const err = new NetworkError(cause);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NetworkError);
    expect(err.name).toBe("NetworkError");
    expect(err.cause).toBe(cause);
  });

  test("constructs without a cause", () => {
    const err = new NetworkError();
    expect(err.message).toBe("Network request failed");
    expect(err.cause).toBeUndefined();
  });
});
