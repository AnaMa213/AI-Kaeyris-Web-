import { expectTypeOf, test } from "vitest";
import type { ApiClient } from "@/lib/api/client";

test("ApiClient exposes temporary mock endpoints without casts", () => {
  const callsMockEndpoints = (client: ApiClient) => {
    void client.GET("/services/jdr/sessions/{session_id}/audio", {
      params: { path: { session_id: "session-123" } },
      parseAs: "blob",
    });

    void client.DELETE("/services/jdr/pjs/{pj_id}", {
      params: { path: { pj_id: "pj-123" } },
    });
  };

  expectTypeOf(callsMockEndpoints).toBeFunction();
});
