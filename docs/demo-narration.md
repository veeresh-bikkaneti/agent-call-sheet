# The real demo video — narration script

The spoken script for `docs/media/real-demo.mp4`, exactly as narrated.
The voice is text-to-speech (a natural production voice), not a human
recording — the video itself says so in its first scene and on its end card.

## Scene 1 — Title

Welcome to The Agent Call Sheet. We are going to watch a real run, step by step. This voice is text to speech, not a human recording.

## Scene 2 — Step 1, in the terminal

Step 1 — check out the code. First, we built a fresh Debian machine image. That took nine minutes thirty-four seconds, including two failed attempts — we fast-forward the waits, and the video says so. The usual launcher, systemd-nspawn, was blocked here, so we adapted honestly: the same fresh image ran through an isolated chroot launch, and we label it that way.

## Scene 3 — Step 2, in the terminal and the guides

Step 2 — set it up locally. Inside that image, we cloned the kit — forty-one seconds, and you can see the exact commit in the log. Then we opened the front door in under a second. You can do the same with the install guides in the kit: Claude and Grok each have guides — claude-code, claude-web, grok-build, and grok-web. Any chat window, for example Gemini, takes the starter prompt through the prompt-only route. There is no dedicated Gemini guide.

## Scene 4 — Step 3, on the board

Step 3 — give it a task. The task was a one-page site for Northbeam Roast, a fictional coffee brand. Watch the task cards fly to eight seats.

## Scene 5 — Step 4, on the board, and the finished page

Step 4 — observe the task being completed. Listen in on standup and the in-flight chatter. Click a character — here is the Developer, mid-run — and you see their ticket and last line. The build took fourteen seconds. Then the independent checker bounced one wrong count, fifty-five versus fifty-one, the fix landed, and the gate passed. Total run: twenty-nine minutes thirty-six seconds. Proof first, claims second — thank you for watching.

## How this video was made (production notes)

- The run is real, dated **2026-10-26**: we built a fresh Debian 12 machine
  image with debootstrap, cloned the kit inside it, read the front door,
  handed the crew one task (a one-page site for the fictional Northbeam
  Roast brand), and watched an independent checker gate the result. Total
  wall clock: 29 minutes 36 seconds. Spin-up took 9 minutes 34 seconds
  including two failed attempts; the successful debootstrap took 142
  seconds; the clone took 41 seconds; the front-door read took under a
  second; the build took 14 seconds; the gates took about 4 minutes.
- **Board replay, not a screen recording of the run itself.** The crew
  segment is a replay of that run on the cast board in
  `docs/live-run.html`, driven beat by beat from the run transcript —
  every speech bubble quotes the transcript verbatim. The recording
  includes the card flights, the standup, the in-flight chatter, a real
  click on the Developer character mid-run opening their status panel,
  the gate bounce, the fix, the pass, and the all-done end state. You can
  replay the board yourself from `docs/live-run.html`.
- **Terminal frames are the run's own logs.** Each terminal frame renders
  actual excerpts extracted from the run's log files (the spin-up log
  including the nspawn failure line, the install typescript with the clone
  and its HEAD commit, the front-door log, and the build log). No log line
  was retyped.
- **Fast-forwards are labelled, never silent.** Long waits are compressed
  to fit the video, and the frames say so on screen with a visible
  fast-forward banner and the real durations as captions.
- **The adaptation is stated, not hidden.** systemd-nspawn was blocked in
  our sandbox, so the same fresh machine image ran through an isolated
  chroot launch. The video, this script, and the board all label it that
  way — it is never called an nspawn or systemd boot.
- **Provider GUI attempt — outcome.** We opened claude.ai and grok.com in
  a fresh browser profile with no credentials, and attempted no login. In
  this sandbox neither site even loaded (the network tunnel refused the
  connection), and no signed-in session was reachable — as expected
  without sign-in. We faked nothing: the video's GUI leg is therefore the
  cast board plus the docs pages, and the provider routes are the
  install guides named on screen — claude-code, claude-web, grok-build,
  grok-web, and prompt-only (the route any chat window, for example
  Gemini, uses; Gemini has no dedicated guide in the kit). The attempt is
  logged with its screenshots in the run record.
- Narration (260 words) was synthesised from this script with
  text-to-speech and mixed under the frames with ffmpeg. The video is
  H.264 video with AAC audio, 1280×720, 99 seconds.
