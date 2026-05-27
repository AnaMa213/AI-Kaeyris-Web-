import createClient, { type Client, type ClientOptions } from "openapi-fetch";
import type { paths } from "@/types/api";
import { env } from "@/lib/env";
import { NetworkError } from "@/lib/api/errors";
import { createErrorMiddleware } from "@/lib/api/problemDetails";
import { audioMockMiddleware } from "@/lib/api/mocks/audio";
import { pjDeleteMockMiddleware } from "@/lib/api/mocks/pjDelete";

const networkAwareFetch: NonNullable<ClientOptions["fetch"]> = async (
  request,
) => {
  try {
    return await fetch(request);
  } catch (cause) {
    throw new NetworkError(cause);
  }
};

export function createApiClient(): Client<paths> {
  const client = createClient<paths>({
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
