// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/core/env", () => ({
  env: {
    NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
    NEXT_PUBLIC_MOCK_AUDIO: false,
    NEXT_PUBLIC_MOCK_PJ_DELETE: false,
    NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
  },
}));

const { useJobEventStream, jobEventsPath } = await import(
  "@/lib/jdr/jobs/jobEvents"
);
const { jobQueryKey } = await import("@/lib/jdr/jobs/queries");

/**
 * Minimal EventSource stand-in: records construction args, lets a test drive the
 * `open`/`progress`/`error` lifecycle, and tracks `close()`. jsdom ships no
 * EventSource, so this is the only way to exercise the SSE path.
 */
class MockEventSource {
  static instances: MockEventSource[] = [];
  static reset() {
    MockEventSource.instances = [];
  }
  url: string;
  withCredentials: boolean;
  readyState = 0;
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  private listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(cb);
  }
  removeEventListener(type: string, cb: (e: MessageEvent) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== cb);
  }
  close() {
    this.closed = true;
    this.readyState = 2;
  }
  // --- test drivers ---
  open() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
  emitProgress(data: unknown) {
    const evt = { data: JSON.stringify(data) } as MessageEvent;
    (this.listeners["progress"] ?? []).forEach((cb) => cb(evt));
  }
  emitRawProgress(data: string) {
    const evt = { data } as MessageEvent;
    (this.listeners["progress"] ?? []).forEach((cb) => cb(evt));
  }
  emitError() {
    this.onerror?.(new Event("error"));
  }
}

const sampleJob = {
  id: "job-1",
  kind: "summary" as const,
  session_id: "s1",
  status: "queued" as const,
  failure_reason: null,
  queued_at: "2026-06-01T10:00:00Z",
  started_at: null,
  ended_at: null,
};

function setup(jobId: string | null, enabled = true, seed = true) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  if (seed && jobId) client.setQueryData(jobQueryKey(jobId), sampleJob);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useJobEventStream(jobId, { enabled }), {
    wrapper,
  });
  return { client, ...view };
}

beforeEach(() => {
  MockEventSource.reset();
  vi.stubGlobal("EventSource", MockEventSource);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useJobEventStream", () => {
  test("opens a credentialed EventSource on the job events path", () => {
    setup("job-1");
    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toBe(`http://localhost:8000${jobEventsPath("job-1")}`);
    expect(es.withCredentials).toBe(true);
  });

  test("a progress event merges the projection onto the cached job", async () => {
    const { client } = setup("job-1");
    act(() =>
      MockEventSource.instances[0].emitProgress({
        status: "running",
        phase: null,
        progress_percent: null,
      }),
    );
    await waitFor(() =>
      expect(client.getQueryData(jobQueryKey("job-1"))).toMatchObject({
        id: "job-1",
        kind: "summary",
        status: "running",
      }),
    );
  });

  test("an invalid progress frame closes the stream and reports not-connected", async () => {
    const { result } = setup("job-1");
    const es = MockEventSource.instances[0];
    act(() => es.open());
    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => es.emitRawProgress("{invalid-json"));

    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(es.closed).toBe(true);
  });

  test("a progress frame without a valid status closes the stream", async () => {
    const { result } = setup("job-1");
    const es = MockEventSource.instances[0];
    act(() => es.open());
    await waitFor(() => expect(result.current.connected).toBe(true));

    act(() => es.emitProgress({ phase: "loading" }));

    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(es.closed).toBe(true);
  });

  test("a terminal progress event closes the stream (no auto-reconnect)", () => {
    setup("job-1");
    const es = MockEventSource.instances[0];
    act(() => es.emitProgress({ status: "succeeded" }));
    expect(es.closed).toBe(true);
  });

  test("connected flips true on open and back to false on the terminal event", async () => {
    const { result } = setup("job-1");
    expect(result.current.connected).toBe(false);
    act(() => MockEventSource.instances[0].open());
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => MockEventSource.instances[0].emitProgress({ status: "succeeded" }));
    await waitFor(() => expect(result.current.connected).toBe(false));
  });

  test("a stream error closes the source and reports not-connected (polling fallback)", async () => {
    const { result } = setup("job-1");
    const es = MockEventSource.instances[0];
    act(() => es.open());
    await waitFor(() => expect(result.current.connected).toBe(true));
    act(() => es.emitError());
    // The fallback signal consumed by useJob is `connected:false` — polling resumes.
    await waitFor(() => expect(result.current.connected).toBe(false));
    expect(es.closed).toBe(true);
  });

  test("unmount closes the stream", () => {
    const { unmount } = setup("job-1");
    const es = MockEventSource.instances[0];
    unmount();
    expect(es.closed).toBe(true);
  });

  test("changing jobId closes the old stream and tracks the new one", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(jobQueryKey("job-1"), sampleJob);
    client.setQueryData(jobQueryKey("job-2"), { ...sampleJob, id: "job-2" });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const initialProps: { jobId: string | null } = { jobId: "job-1" };
    const { rerender, result } = renderHook(
      ({ jobId }: { jobId: string | null }) =>
        useJobEventStream(jobId, { enabled: true }),
      {
        initialProps,
        wrapper,
      },
    );
    const first = MockEventSource.instances[0];
    act(() => first.open());
    await waitFor(() => expect(result.current.connected).toBe(true));

    rerender({ jobId: "job-2" });

    await waitFor(() => expect(first.closed).toBe(true));
    await waitFor(() => expect(MockEventSource.instances).toHaveLength(2));
    expect(result.current.connected).toBe(false);

    const second = MockEventSource.instances[1];
    act(() => second.open());
    await waitFor(() => expect(result.current.connected).toBe(true));

    rerender({ jobId: null });

    await waitFor(() => expect(second.closed).toBe(true));
    await waitFor(() => expect(result.current.connected).toBe(false));
  });

  test("disabled or null jobId opens no stream", () => {
    setup(null, true);
    setup("job-2", false);
    expect(MockEventSource.instances).toHaveLength(0);
  });

  test("with EventSource unavailable the hook is a no-op (supported:false)", () => {
    vi.stubGlobal("EventSource", undefined);
    const { result } = setup("job-1");
    expect(result.current.supported).toBe(false);
    expect(result.current.connected).toBe(false);
    expect(MockEventSource.instances).toHaveLength(0);
  });
});
