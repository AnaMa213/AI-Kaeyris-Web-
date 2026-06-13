// @vitest-environment jsdom

import { afterEach, describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

async function importWithEnv(mockAudio: boolean) {
  vi.doMock("@/lib/core/env", () => ({
    env: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:8000",
      NEXT_PUBLIC_MOCK_AUDIO: mockAudio,
      NEXT_PUBLIC_MOCK_PJ_DELETE: false,
      NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED: false,
    },
  }));

  return await import("@/components/audio/AudioPlayer");
}

describe("<AudioPlayer>", () => {
  test("renders native audio controls with metadata preload and the given source", async () => {
    const { AudioPlayer } = await importWithEnv(false);

    const { container } = render(
      <AudioPlayer src="/mocks/demo-session.m4a" aria-label="Audio test" />,
    );
    const audio = container.querySelector("audio");

    expect(audio).toBeInTheDocument();
    expect(audio?.getAttribute("src")).toBe("/mocks/demo-session.m4a");
    expect(audio?.getAttribute("preload")).toBe("metadata");
    expect(audio).toHaveAttribute("controls");
    expect(screen.getByLabelText("Audio test")).toBe(audio);
  });

  test("shows the mock demo tag only in mock audio mode", async () => {
    const { AudioPlayer } = await importWithEnv(true);

    render(<AudioPlayer src="/mocks/demo-session.m4a" />);

    expect(
      screen.getByText("Mock audio démo · audio réel en V2"),
    ).toBeInTheDocument();
  });

  test("hides the mock demo tag when mock audio mode is off", async () => {
    const { AudioPlayer } = await importWithEnv(false);

    render(<AudioPlayer src="http://localhost:8000/audio" />);

    expect(
      screen.queryByText("Mock audio démo · audio réel en V2"),
    ).not.toBeInTheDocument();
  });

  test("toggles play and pause with Space when the player has focus", async () => {
    const playMock = vi
      .spyOn(HTMLMediaElement.prototype, "play")
      .mockResolvedValue(undefined);
    const pauseMock = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => {});
    const { AudioPlayer } = await importWithEnv(false);

    const { container } = render(<AudioPlayer src="/audio.m4a" />);
    const audio = container.querySelector("audio");
    if (!audio) throw new Error("Expected audio element");

    audio.focus();
    fireEvent.keyDown(audio, { code: "Space", key: " " });

    expect(playMock).toHaveBeenCalledTimes(1);
    expect(pauseMock).not.toHaveBeenCalled();

    Object.defineProperty(audio, "paused", {
      configurable: true,
      value: false,
    });

    fireEvent.keyDown(audio, { code: "Space", key: " " });

    expect(pauseMock).toHaveBeenCalledTimes(1);
  });
});
