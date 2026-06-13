// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { useDebouncedValue } from "@/lib/core/hooks/useDebouncedValue";

function Probe({ value, delay }: { value: string; delay: number }) {
  const debounced = useDebouncedValue(value, delay);
  return <span data-testid="out">{debounced}</span>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDebouncedValue", () => {
  test("returns the initial value immediately", () => {
    const { getByTestId } = render(<Probe value="a" delay={250} />);
    expect(getByTestId("out").textContent).toBe("a");
  });

  test("only updates after the delay elapses", () => {
    const { getByTestId, rerender } = render(<Probe value="a" delay={250} />);
    rerender(<Probe value="ab" delay={250} />);
    // Not yet — under the delay.
    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(getByTestId("out").textContent).toBe("a");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(getByTestId("out").textContent).toBe("ab");
  });

  test("a fresh value before the deadline resets the timer (trailing update)", () => {
    const { getByTestId, rerender } = render(<Probe value="a" delay={250} />);
    rerender(<Probe value="ab" delay={250} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender(<Probe value="abc" delay={250} />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    // 400ms total but the timer reset at 200ms — still pending.
    expect(getByTestId("out").textContent).toBe("a");
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(getByTestId("out").textContent).toBe("abc");
  });
});
