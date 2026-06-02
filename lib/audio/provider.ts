import { env } from "@/lib/core/env";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isReducerRequired(): boolean {
  return env.NEXT_PUBLIC_AUDIO_REDUCER_REQUIRED;
}

export function shouldReduce(fileSize: number): boolean {
  return isReducerRequired() && fileSize > MAX_UPLOAD_BYTES;
}
