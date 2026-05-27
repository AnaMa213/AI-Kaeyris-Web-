export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [extension: string]: unknown;
}

export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.title);
    this.problem = problem;
    this.name = "ApiError";
  }
}

export class AuthError extends ApiError {
  constructor(problem: ProblemDetails) {
    super(problem);
    this.name = "AuthError";
  }
}

export class NetworkError extends Error {
  constructor(cause?: unknown) {
    super("Network request failed");
    this.name = "NetworkError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}
