// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useRotatingText } from "@/lib/jdr/sessions/useRotatingText";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRotatingText", () => {
  test("rotates through the lines on each interval tick", () => {
    const lines = ["un", "deux", "trois"];
    const { result } = renderHook(() =>
      useRotatingText(lines, { intervalMs: 1000, enabled: true }),
    );

    expect(result.current.current).toBe("un");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.current).toBe("deux");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.current).toBe("trois");

    // wraps back to the first line.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.current).toBe("un");
  });

  test("resets the index to 0 when the lines array changes (acte transition)", () => {
    const { result, rerender } = renderHook(
      ({ lines }) => useRotatingText(lines, { intervalMs: 1000, enabled: true }),
      { initialProps: { lines: ["a1", "a2"] } },
    );

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.current).toBe("a2");

    // Switch acts: new lines → restart from the first.
    rerender({ lines: ["b1", "b2", "b3"] });
    expect(result.current.current).toBe("b1");
  });

  test("a single line never schedules a tick and stays stable", () => {
    const { result } = renderHook(() =>
      useRotatingText(["seule"], { intervalMs: 1000, enabled: true }),
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.current).toBe("seule");
  });
});
