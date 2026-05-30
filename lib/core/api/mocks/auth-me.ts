import type { AuthMeResponse } from "@/lib/core/session/types";

export function mockAuthMe(): AuthMeResponse {
  return {
    user: {
      id: "kenan",
      username: "Kenan",
    },
    active_campaign: {
      id: "campaign-default",
      name: "Campagne par défaut",
      role: "gm",
      character_id: "kenan-pc",
    },
  };
}
