// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

type ProgressHandler = (e: { progress: number }) => void;

const mocks = vi.hoisted(() => {
  const state = {
    load: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue(0),
    readFile: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4])),
    deleteFile: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    progressHandler: undefined as ((e: { progress: number }) => void) | undefined,
  };
  return state;
});

vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: function FFmpegMock() {
    return {
      load: mocks.load,
      writeFile: mocks.writeFile,
      exec: mocks.exec,
      readFile: mocks.readFile,
      deleteFile: mocks.deleteFile,
      on: (event: string, handler: ProgressHandler) => {
        if (event === "progress") mocks.progressHandler = handler;
        mocks.on(event, handler);
      },
      off: (event: string, handler: ProgressHandler) => {
        if (event === "progress") mocks.progressHandler = undefined;
        mocks.off(event, handler);
      },
    };
  },
}));

vi.mock("@ffmpeg/util", () => ({
  fetchFile: vi.fn().mockResolvedValue(new Uint8Array([5, 6, 7, 8])),
}));

const { reduceAudio, __resetFFmpegInstanceForTests } = await import(
  "@/lib/audio/reduce"
);

beforeEach(() => {
  __resetFFmpegInstanceForTests();
  mocks.load.mockClear().mockResolvedValue(undefined);
  mocks.writeFile.mockClear().mockResolvedValue(undefined);
  mocks.exec.mockClear().mockResolvedValue(0);
  mocks.readFile.mockClear().mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
  mocks.deleteFile.mockClear().mockResolvedValue(undefined);
  mocks.on.mockClear();
  mocks.off.mockClear();
  mocks.progressHandler = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reduceAudio", () => {
  test("returns a File named *.reduced.m4a with MIME audio/mp4 on the happy path", async () => {
    const input = new File([new Uint8Array([0])], "Session-12.m4a", {
      type: "audio/mp4",
    });
    const reduced = await reduceAudio(input);

    expect(reduced).toBeInstanceOf(File);
    expect(reduced.name).toBe("Session-12.reduced.m4a");
    expect(reduced.type).toBe("audio/mp4");
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.exec).toHaveBeenCalledWith([
      "-i",
      "input.m4a",
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "24k",
      "-ac",
      "1",
      "output.m4a",
    ]);
    expect(mocks.deleteFile).toHaveBeenCalledWith("input.m4a");
    expect(mocks.deleteFile).toHaveBeenCalledWith("output.m4a");
  });

  test("forwards ffmpeg progress events to onProgress(percent 0–100)", async () => {
    const input = new File([new Uint8Array([0])], "x.m4a", {
      type: "audio/mp4",
    });
    const onProgress = vi.fn();

    mocks.exec.mockImplementationOnce(async () => {
      mocks.progressHandler?.({ progress: 0.42 });
      return 0;
    });

    await reduceAudio(input, onProgress);
    expect(onProgress).toHaveBeenCalledWith(42);
  });

  test("rejects with AbortError when the signal is already aborted before exec", async () => {
    const input = new File([new Uint8Array([0])], "x.m4a", {
      type: "audio/mp4",
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      reduceAudio(input, undefined, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(mocks.exec).not.toHaveBeenCalled();
  });

  test("propagates ffmpeg failures as rejections and still unsubscribes the progress listener", async () => {
    const input = new File([new Uint8Array([0])], "x.m4a", {
      type: "audio/mp4",
    });
    const boom = new Error("ffmpeg.exec exploded");
    mocks.exec.mockRejectedValueOnce(boom);

    await expect(reduceAudio(input)).rejects.toBe(boom);
    expect(mocks.off).toHaveBeenCalled();
  });
});
