# Portable production helpers

Run commands from the installed skill directory, or resolve the scripts'
absolute location from the active skill. Do not assume the user's working
directory is the skill directory. Use Node `path.resolve`, `path.join` and
`os.homedir` instead of hardcoded drive letters, usernames or `/tmp`.
Use the current OS's shell syntax and path separators.

## Setup diagnostics

```text
node scripts/styk-tools.cjs doctor
```

Checks Node 24+, built-in Zstandard, and Windows/Linux/macOS. Reports the current
OS, architecture and resolved directories. It fails explicitly for unsupported
environments. It does not certify browser automation, codec support, login,
permissions, or network access. Avoid posting its machine-local paths publicly.

## Storyboards

Copy the schema in [the storyboard example](../examples/storyboard.json) and
replace the story, not just the title:

```text
node scripts/styk-tools.cjs storyboard examples/storyboard.json plan.json
```

Each beat needs `action` and positive `seconds` corresponding to whole frames.
Optional beat fields (actors, props, camera, sound, notes) are preserved.
The result adds contiguous 1-based inclusive frame ranges and start/end seconds.
It is a beat sheet, **not animation generation**; implement the choreography
with the animation library. Avoid camera promises the authoring API cannot meet.

## Generate exact verification requirements

```text
node scripts/styk-tools.cjs expectations movie.json examples/export-options.json expected.json
```

The export options contain `width`, `height`, and `audioTracks` (defaults:
1920, 1080, 0). Aspect ratio must match the scene. Output includes exact
frame count, FPS, duration, native dimensions/title and figure types.
Use the actual JSON import filename stem as the app title or rename in the app
to match the expected project name before saving. Do not change expectations
to hide an incorrect export.

`verify` accepts optional `video.audioTracks`; generated specs always include
it. Legacy handwritten specs without it retain their previous behavior.
An audio track proves neither audible content nor correct synchronization.

## Original WAV cues

```text
node scripts/styk-tools.cjs audio examples/soundtrack.json soundtrack.wav
node scripts/styk-tools.cjs inspect-wav soundtrack.wav
```

The input needs total `seconds`, optional `sampleRate` (24000, 44100 or 48000),
and `cues`. Each cue has:

| Field | Meaning |
|---|---|
| `kind` | `tone` (sine) or `noise` (deterministic broadband noise) |
| `start`, `seconds` | Timeline position and duration in seconds |
| `gain` | 0..1, default 0.15 |
| `frequency` | Tone frequency in Hz, default 440, below Nyquist |
| `fade` | Attack/release seconds, default 0.01; positive, <= half cue length |

The generator writes mono PCM16 WAV and refuses clipping instead of silently
normalizing. Boundaries use sample rounding; cues must fit the soundtrack.
Limits: 10 minutes, 1000 cues. Memory usage is proportional to duration/rate.
An empty cue array intentionally creates silence. `inspect-wav` supports
mono/stereo PCM16 RIFF/WAVE, not arbitrary WAV codecs or RF64.

These are basic original sound-design building blocks, not naturalistic foley,
speech, music composition or licensed sample libraries. Listen before use.
Keep a record of sources/licenses for any external audio or artwork. Do not
upload private assets to external services without permission.

## Browser scene inspection

```json
{"pageId":"CURRENT_PAGE_ID"}
```

Pass to `browser inspect-scene`. Reports title, visible artboard CSS bounding
box, edited status, audio panel visibility and import accept strings without
changing the project. CSS size is not native scene resolution.

## Audio import (experimental)

```json
{
  "pageId": "CURRENT_PAGE_ID",
  "projectName": "My film",
  "file": "ABSOLUTE_PATH_ON_THIS_MACHINE",
  "clipName": "soundtrack.wav"
}
```

Pass to `browser import-audio`. `clipName` must match the file basename.
The operation checks the project, pauses playback, opens the audio panel,
rejects a visible duplicate filename, imports through the ordinary audio input,
and waits for a visible clip. It does not set or verify the clip's start time.

Selectors were observed in the app on 2026-10-22; this operation has not
completed a new end-to-end import/export regression in this release. After
import, verify the clip starts at 0, has the intended duration and volume, and
plays in sync. Save STYK, reopen it, export, verify `audioTracks: 1`, and listen
to opening, middle, cue boundaries and ending. If a timeout occurs, inspect
before retrying; do not add a duplicate clip.

All new output commands refuse overwriting. Inputs and outputs are local files;
website operations run in the selected StykAnimate origin, whose terms and
privacy policy still apply. Recovery reads app-local browser storage only when
explicitly requested; never publish recovered user projects as toolkit examples.
