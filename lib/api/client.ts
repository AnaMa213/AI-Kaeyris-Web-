import createClient, { type Client, type ClientOptions } from "openapi-fetch";
import type { paths } from "@/types/api";
import { env } from "@/lib/env";
import { NetworkError, type ProblemDetails } from "@/lib/api/errors";
import { createErrorMiddleware } from "@/lib/api/problemDetails";
import { audioMockMiddleware } from "@/lib/api/mocks/audio";
import { pjDeleteMockMiddleware } from "@/lib/api/mocks/pjDelete";

type AudioMockPath = "/services/jdr/sessions/{session_id}/audio";
type PjDeleteMockPath = "/services/jdr/pjs/{pj_id}";
type AuthLoginPath = "/auth/login";
type AuthLogoutPath = "/auth/logout";

type AudioMockGetOperation = {
  parameters: {
    query?: never;
    header?: never;
    path: {
      session_id: string;
    };
    cookie?: never;
  };
  requestBody?: never;
  responses: {
    200: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "audio/mp4": Blob;
      };
    };
    404: {
      headers: {
        [name: string]: unknown;
      };
      content: {
        "application/problem+json": ProblemDetails;
      };
    };
  };
};

type PjDeleteMockOperation = {
  parameters: {
    query?: never;
    header?: never;
    path: {
      pj_id: string;
    };
    cookie?: never;
  };
  requestBody?: never;
  responses: {
    204: {
      headers: {
        [name: string]: unknown;
      };
      content?: never;
    };
  };
};

type AuthLoginPostOperation = {
  parameters: {
    query?: never;
    header?: never;
    path?: never;
    cookie?: never;
  };
  requestBody: {
    content: {
      "application/json": { profile: "gm" | "player"; password: string };
    };
  };
  responses: {
    200: {
      headers: { [name: string]: unknown };
      content?: never;
    };
    401: {
      headers: { [name: string]: unknown };
      content: { "application/problem+json": ProblemDetails };
    };
    403: {
      headers: { [name: string]: unknown };
      content: { "application/problem+json": ProblemDetails };
    };
  };
};

type AuthLogoutPostOperation = {
  parameters: {
    query?: never;
    header?: never;
    path?: never;
    cookie?: never;
  };
  requestBody?: never;
  responses: {
    204: {
      headers: { [name: string]: unknown };
      content?: never;
    };
  };
};

// Temporary overlay until BD-1/BD-2/BD-3 ship their endpoints in openapi.json.
type ApiClientPaths = Omit<paths, AudioMockPath> & {
  [Path in AudioMockPath]: Omit<paths[AudioMockPath], "get"> & {
    get: AudioMockGetOperation;
  };
} & {
  [Path in PjDeleteMockPath]: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post?: never;
    delete: PjDeleteMockOperation;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
} & {
  [Path in AuthLoginPath]: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: AuthLoginPostOperation;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
} & {
  [Path in AuthLogoutPath]: {
    parameters: {
      query?: never;
      header?: never;
      path?: never;
      cookie?: never;
    };
    get?: never;
    put?: never;
    post: AuthLogoutPostOperation;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
};

export type ApiClient = Client<ApiClientPaths>;

const networkAwareFetch: NonNullable<ClientOptions["fetch"]> = async (
  request,
) => {
  try {
    return await fetch(request);
  } catch (cause) {
    throw new NetworkError(cause);
  }
};

export function createApiClient(): ApiClient {
  const client = createClient<ApiClientPaths>({
    baseUrl: env.NEXT_PUBLIC_API_BASE_URL,
    credentials: "include",
    fetch: networkAwareFetch,
  });

  if (env.NEXT_PUBLIC_MOCK_AUDIO) {
    client.use(audioMockMiddleware);
  }
  if (env.NEXT_PUBLIC_MOCK_PJ_DELETE) {
    client.use(pjDeleteMockMiddleware);
  }
  client.use(createErrorMiddleware());

  return client;
}
