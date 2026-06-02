// Lazy-loaded module: `@ffmpeg/ffmpeg` weighs ~25 MB compressed. Importing it
// only when reduceAudio() is actually called keeps the neutral path (small file
// or reducer-not-required) free of the wasm bundle.

type FFmpegLike = {
  load(): Promise<void>;
  writeFile(name: string, data: Uint8Array): Promise<void>;
  exec(args: string[]): Promise<number>;
  readFile(name: string): Promise<Uint8Array | string>;
  deleteFile(name: string): Promise<void>;
  on(event: "progress", handler: (e: { progress: number }) => void): void;
  off(event: "progress", handler: (e: { progress: number }) => void): void;
};

let ffmpegInstance: FFmpegLike | null = null;

async function getFFmpeg(): Promise<FFmpegLike> {
  if (ffmpegInstance) return ffmpegInstance;
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const ff = new FFmpeg() as unknown as FFmpegLike;
  await ff.load();
  ffmpegInstance = ff;
  return ff;
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}

export async function reduceAudio(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<File> {
  throwIfAborted(signal);

  const ff = await getFFmpeg();
  throwIfAborted(signal);

  const { fetchFile } = await import("@ffmpeg/util");
  const inputName = "input.m4a";
  const outputName = "output.m4a";

  const inputData = (await fetchFile(file)) as Uint8Array;
  await ff.writeFile(inputName, inputData);
  throwIfAborted(signal);

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.max(0, Math.min(100, Math.round(progress * 100))));
  };
  ff.on("progress", progressHandler);

  try {
    await ff.exec([
      "-i",
      inputName,
      "-vn",
      "-c:a",
      "aac",
      "-b:a",
      "24k",
      "-ac",
      "1",
      outputName,
    ]);
  } finally {
    ff.off("progress", progressHandler);
  }

  throwIfAborted(signal);

  const data = (await ff.readFile(outputName)) as Uint8Array;
  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  // Wrap the bytes in a fresh Uint8Array so the Blob constructor receives an
  // ArrayBufferView whose buffer is guaranteed to be ArrayBuffer (not a
  // SharedArrayBuffer) — keeps Blob() happy across browser quirks.
  const bytes = new Uint8Array(data);
  const blob = new Blob([bytes], { type: "audio/mp4" });
  const reducedName =
    file.name.replace(/\.m4a$/i, "") + ".reduced.m4a";
  return new File([blob], reducedName, { type: "audio/mp4" });
}

// Test-only: lets the singleton be cleared between tests so we exercise the
// lazy import path freshly. Not exported via index.ts; consumers should not
// touch this in production code.
export function __resetFFmpegInstanceForTests(): void {
  ffmpegInstance = null;
}
