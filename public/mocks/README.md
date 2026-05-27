# public/mocks

Local placeholders consumed by `lib/api/mocks/*` while backend dependencies BD-2 (`GET /audio`) and BD-3 (`DELETE /pjs/{id}`) are pending. The audio mock middleware fetches `/mocks/demo-session.m4a` from this folder; if the file is missing it returns a typed 404 Problem Details payload so the consumer surface stays consistent with the real future endpoint.

The audio binary itself is **gitignored** to avoid bloating the repo. Drop a small `demo-session.m4a` here for the audio player visual check — either reuse a known-good sample from your local session archive, or generate a 5-second silent M4A:

```
ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 5 -c:a aac demo-session.m4a
```

When backend ships BD-2 (V2), the mock middleware is dropped or `NEXT_PUBLIC_MOCK_AUDIO` flipped to `false`, and this folder becomes superfluous.
