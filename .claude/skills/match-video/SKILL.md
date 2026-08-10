---
name: match-video
description: Archive a match recording from a beelup.com share link — trim to the match window at download time and upload to the app's R2 media bucket. Use when the user shares a beelup player link or asks to download/archive a match video.
---

# Match video archival

Beelup share links expire **7 days** after generation. If the link is fresh,
do the download step promptly, even if the trim window isn't decided yet (a
full download can be re-trimmed locally later; an expired link is gone).

## 1. Derive the playlist URL

A share link looks like:

    https://beelup.com/player.php?id=<ID>&t=<T>&mo=completo

`t` is a seek offset into the recording, **not** the match start — ignore it.
The HLS playlist for an arbitrary window is:

    https://beelup.com/obtener.video.playlist.php?id=<ID>&camara=&tipo=todo&formato=m3u8&desde=<START>&duracion=<LENGTH>

`desde` = window start in seconds from the beginning of the recording,
`duracion` = window length in seconds. Both empty = the full recording.

## 2. Find the trim window

Fetch the full playlist (both parameters empty). Each `#EXTINF` line carries
the wall-clock time and the offset in seconds:

    #EXTINF:2.000,2026-08-09 16:42:55,2575.52

The first line gives the recording's start time. From there, map whatever the
user knows (wall-clock times, "the match started 10 minutes in") to `desde`
and `duracion`. Cuts land on 2-second segment boundaries — accurate enough
that no local re-cutting is needed. If the user hasn't picked timestamps yet,
give them the recording's wall-clock range and ask for start and end.

## 3. Download

    ffmpeg -i '<playlist URL with desde/duracion>' -c copy -movflags +faststart <name>.mp4

- `-c copy` — never re-encode; the source is already ~1.3 Mbps H.264.
- `+faststart` — required for instant playback when streamed from R2.
- Expect DTS-discontinuity warnings at the recording's internal 5-minute
  chunk joins; ffmpeg rewrites the timeline and the output is continuous.

Verify with `ffprobe`: duration must match `duracion` (±5 s) — a short file
means segments failed mid-download; re-run.

## 4. Upload to R2

Bucket `lapapeinliga-media`, key convention `matches/<yyyy-mm-dd>-<slug>.mp4`
(date of the match, short lowercase slug, e.g. `matches/2026-08-09-final-apertura.mp4`).

Needs `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — the same
values configured as Supabase secrets for the `media-upload` Edge Function
(values are not retrievable from Supabase; get them from the Cloudflare
dashboard or wherever the user keeps them). Ask the user if they're not in
the environment.

    curl --fail --aws-sigv4 "aws:amz:auto:s3" \
      --user "$R2_ACCESS_KEY_ID:$R2_SECRET_ACCESS_KEY" \
      -H 'Content-Type: video/mp4' \
      --upload-file <name>.mp4 \
      "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com/lapapeinliga-media/matches/<key>.mp4"

A single PUT is fine up to 5 GB; a match is ~700 MB per 80 minutes.

## 5. Attach the video to its event

`events.video_key` holds the key; the event page renders the player from it.
The column has a CHECK pinning the key shape — a typo'd key is rejected, not
stored broken.

Ask the user which fecha the video belongs to if it isn't obvious. Then, with
`.env` sourced (`SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`), run the
update through the session pooler — the direct `db.<ref>.supabase.co` host is
IPv6-only and unreachable from IPv4 networks. `psql` is not installed, but
the repo's `pg` package works from `node` in the repo root:

    node -e "
    const { Client } = require('pg');
    const c = new Client({
      connectionString: \`postgresql://postgres.\${process.env.SUPABASE_PROJECT_REF}:\${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@aws-1-sa-east-1.pooler.supabase.com:5432/postgres\`,
      ssl: { rejectUnauthorized: false },
    });
    c.connect()
      .then(() => c.query('UPDATE events SET video_key = \$1 WHERE short_id = \$2 RETURNING id', ['matches/<key>.mp4', '<short_id>']))
      .then((r) => { console.log(r.rowCount === 1 ? 'attached' : 'NO SUCH EVENT'); return c.end(); });
    "

## 6. Verify

Confirm the public URL plays (fetch headers: 200, `content-type: video/mp4`,
expected size):

    https://pub-df9f9a703547492297599f5504e26d19.r2.dev/matches/<key>.mp4

Then confirm the video renders on the event's page. Share links carry
timestamps: `/fechas/<short_id>?t=<seconds>` deep-links into the video, and
`&end=<seconds>` makes it a clip that stops there.
