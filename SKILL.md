---
name: stykanimate-movie-skill
description: 'Create, animate, save, and export short films in StykAnimate at app.stykanimate.com from a user-provided story. Use for movies, stick-figure animation, storyboards, sound cues, animated scenes, and natural movement. Includes portable Node.js tools for rigs, inverse kinematics, planted-foot walks, PNG assets, WAV sound, JSON import, browser automation, MP4 export, native STYK inspection, and decoded-frame verification on Windows, Linux and macOS. Reuse these tools instead of rebuilding helpers.'
argument-hint: 'Story, approximate duration, visual style, and optional dialogue or audio'
---

# StykAnimate movie maker

Turn the user's story into a finished animation in <https://app.stykanimate.com/>.
Deliver a playable movie and a reusable native `.styk` project, not just a plan.

## Portable setup

Requires Node.js 24+ on Windows, Linux or macOS and a skill-capable agent host.
Resolve scripts from this skill's installed directory, not the user's current
working directory. Run `node <resolved-scripts-path>/styk-tools.cjs doctor`.
Use native path separators, Node path/os helpers, and quote paths with spaces.
Never assume PowerShell, Bash, drive letters, home or download directories.
Phones/tablets are not standalone toolkit hosts. ARM/browser host compatibility
requires verification; portable code is not proof of every device working.

See [installation](./README.md), [production helpers](./references/production.md),
and [publishing plan](./PUBLISHING.md). Browser automation is provided by the
agent host, not installed by this skill. Without it, use the manual recipes.
For remote hosts, confirm browser and Node can access the same selected files.

## Start here

1. Read this skill and [tool guide](./references/tools.md). Prefer the bundled
   tools; [browser recipes](./references/browser-recipes.md) are manual fallbacks.
2. Discover the browser tools through tool search before using deferred tools.
   Typical capabilities: open/read page, run Playwright, screenshot, handle dialogs.
   Use the current tool schemas, not remembered tool argument signatures.
3. Reuse the user's shared StykAnimate page when available. Otherwise open the app.
   Obtain the current page ID; never reuse a page ID from an earlier session.
4. Read the page once to establish the current project and available controls.
   Preserve existing work: save before replacing a project; do not silently erase
   an existing movie. Use **File > New animation** for a new story.
5. Reuse the toolkit below. Write only the story-specific choreography and art,
   not new copies of the IK solver, file encoder, exporter, or validators.
   Explore only a changed or missing control. Take screenshots at meaningful
   visual checkpoints.

Tested in the browser app on 2026-10-21. Labels and internals can change.
Accessible names below are observed names, not a guarantee about future versions.

## Reusable tools: choose before authoring

Tools live inside this skill and use Node.js 24 with built-in modules only.
They are CLI/library helpers, not newly registered MCP tools. No package install
or browser server is needed.

| Need | Reuse | When |
|---|---|---|
| Story with walks, reaches, multiple actors, or many poses | [animation.cjs](./scripts/animation.cjs) | Preferred for natural movement and longer films; generate dense JSON, then import it into the app |
| First implementation/template | [walk-and-wave.cjs](./examples/walk-and-wave.cjs) | Copy the choreography pattern, not its helper implementation or story |
| CLI entry point | [styk-tools.cjs](./scripts/styk-tools.cjs) | Run `--help`; generate a demo, validate JSON, inspect files, verify outputs, or emit a browser tool call |
| Setup, storyboard, export specs, original sound | [production.cjs](./scripts/production.cjs) through CLI | Use `doctor`, `storyboard`, `expectations`, `audio`, `inspect-wav`; see production reference |
| Scene diagnostics / optional sound import | CLI `browser inspect-scene` / `browser import-audio` | Read-only inspection; audio import is experimental and needs start/duration/listening checks |
| Art conversion, safe import, frame seeking, save/export | [browser.cjs](./scripts/browser.cjs) through CLI `browser` | Generate the appropriate Playwright call instead of retyping browser snippets |
| Output metadata and native file inspection | [formats.cjs](./scripts/formats.cjs) through CLI | Verify exact duration, FPS, dimensions, frame count, and expected native figure types |
| Regression checks after modifying helpers | [tools.test.cjs](./tests/tools.test.cjs) | Run `node --test` on this file |
| Small hand-edited shot or a feature outside toolkit scope | Manual editor workflow below | Use UI posing for a few keys; camera, audio, and multi-layer authoring still need focused verification |

**Dense authoring fast path**

1. Build original SVG art only when needed; use `browser rasterize-assets` to
   turn an asset manifest into portable PNGs.
2. Import the animation library from a story-specific script. Use its rigs,
   tracks, walking poses, IK, prop anchors, and movie builder.
3. Run `validate`. Fix unreachable limb targets rather than stretching bones.
4. Use `browser import-project` with the current page ID, backed-up current
   project, and expected key count. Import is through the app's ordinary file
   input, not by changing its private editor state.
5. Use `browser seek` to inspect important contact and transition poses.
6. Save native STYK and export MP4 with the generated browser calls.
7. Use CLI `verify`, then `browser verify-video`, and reopen the native project.

`createMovie` samples exactly once per output frame, with `duration_raw: 1`.
For example, 60 seconds at 24 fps is 1,440 editable keys. Do **not** add UI
inbetweens or run the sparse-key timing pass on a dense movie.

Browser calls are emitted as JSON arguments for `runPlaywrightCode`; the CLI
does not itself control a browser. Discover the browser tool first, submit the
emitted arguments, and resume any deferred-result ID instead of rerunning work.
Full commands, option schemas, and authoring examples are in the tool guide.

## Story to shot plan

- Follow the user's story, characters, ending, and requested length.
- If no duration is given, aim for a 10-20 second short at 24 fps, 16:9.
  A simple setup, anticipation, action, and payoff is a useful default.
- Make a compact internal beat sheet: shot/beat, duration, actor positions,
  joint poses, props, camera/background, text, and transition.
- Use deliberate anticipation, readable silhouettes, follow-through, and a held
  ending. Animate limbs during walks and gestures; translating a rigid figure
  alone is not a walk cycle.
- Keep characters grounded unless they are deliberately jumping or floating.
  Check feet and prop contact points rather than only root coordinates.
- Do not silently substitute a different story to fit a sample.
- Default to a silent film if audio is unspecified. For requested sound, use
  original WAV cues or authorized assets and the experimental audio import helper.
  Verify clip placement, duration, volume and saved-project reopening; require
  the expected MP4 audio-track count and listen to the actual export. Never
  promise sound from metadata alone. Dialogue/TTS is not bundled.
  Ask about significant ambiguities, not routine creative details.

## Editor map

| Purpose | Observed control |
|---|---|
| Rename | File > Rename project...; textbox `Name your project`; `Save name` |
| New/open/save | File > New animation / Open project... / Save / Save as... |
| Workspaces | `Animate`, `Draw`, `Build` |
| Add content | `Add to the scene`: Stick figure, Text..., Image..., Import figures... |
| Select and pose | `Select and pose`; click figure root or a joint on canvas |
| Figure properties | `X (px)`, `Y (px)`, `Angle (degrees)`, `Scale (%)` |
| Appearance | `Recolor all segments`, `Opacity (%)` |
| Order | `Front`, `Back`, `Z-index`, Figure layer |
| Joint properties | `Angle (degrees)`, `Length (px)`, `Bend (degrees)`, `Use IK` |
| Text dialog | `Text`, `Size · px`, `Bold`, `Alignment`, `Fill`, `Create text` |
| Timeline | `Simple`, `Advanced`, `Add Frame`, `Frame inbetweens`, `Frame easing` |
| Navigation | First frame; Timeline menu > Previous key / Next key / Last frame |
| Playback | `Play` / `Pause`, `Loop playback`, `Frame rate` |
| Clean preview | Disable `Joints` and `Onion skin`; deselect canvas content |
| Output | `Export`, format `Video`, `Export format`, `Size`, `Export MP4` |

Menu ellipses are the Unicode character `…` in accessible names.
Use exact role/name locators; the same labels can occur in multiple panels.

## Build the scene

1. Rename early with a meaningful film title.
2. Use `Animate` and `Simple` timeline for the tested workflow.
3. Establish canvas dimensions and frame rate before animating.
4. Build static scenery before duplicating poses. Import a generated PNG or an
   authorized image through **Add to the scene > Image...**, then send it `Back`.
   The tested 960 x 540 PNG was centered at X=480, Y=270, scale=100.
5. Keep moving props separate from static scenery. A beacon painted into the
   background cannot subsequently move independently.
6. Add text through the app so it remains portable vector text. Text's X position
   acted as a left anchor in the tested default alignment; verify placement
   visually instead of assuming it is centered.
7. Select the actor's root and set its position, scale, and color.
8. Confirm actor/background/title visibility in a screenshot before keyframing.

The recipes include a way to create original backgrounds in a browser canvas
and import them as PNG files without external image services.

## Manual UI animation: poses, then timing

This section applies to sparse keys created with **Add Frame**, not dense JSON.

1. Set the first pose, then use **Add Frame** to create the next pose.
2. Edit transforms on the figure root and articulation on the appropriate joints.
   Before changing `Angle (degrees)`, verify whether the heading says **Figure**
   or **Joint**: the label is shared, but the operation is different.
3. Use small batches of adjacent key poses. Await the expected heading/property
   after canvas selection, since UI updates are asynchronous.
4. Create all key poses before doing the final timing pass.
5. Set duration and easing by walking backward from the last key via
   **Timeline menu > Previous key**.
6. Check the total duration in the timeline and frame count in Export.

### Critical timing pitfall

**Add Frame did not preserve the previous key's hold.** In the tested Simple
timeline, adding a key split the current hold; earlier keys could end up with
zero inbetweens while the new last key inherited the hold. Setting every key's
timing during initial construction therefore produced the wrong total length.

Always perform a separate timing pass after all keys exist. Recheck timings if
you insert more keys afterward.

- A key with `n` inbetweens occupies `(n + 1) / fps` seconds.
- Total playback frames = sum of `(inbetweens + 1)` over the timeline keys.
- Example at 24 fps: 47 inbetweens = 2 seconds; 11 = 0.5 seconds.
- `Constant` holds a pose; `Linear` gives uniform interpolation.
  `Ease in`, `Ease out`, `Auto`, and `Bezier` are also available.
- Preview transition direction and endpoints; do not assume an easing label
  alone produces the intended motion.
- The timecode is hours/minutes-or-seconds/frame-style UI, not a reliable
  standalone duration measurement. Prefer the explicit total and export count.

For longer single-layer films, prefer the dense toolkit. Multi-layer timing
and camera animation are outside its tested authoring scope. Audio helper
selectors were observed, but its new end-to-end acceptance remains a release gate.

## Preview and export

1. Hide joints/onion skin and deselect objects. Play the complete film.
2. Check opening composition, action apex, landing/contact, and ending.
   Confirm that text does not cover action and that the story is understandable.
3. Open **Export**:
   - Format: `Video`
   - Export format: `MP4 (.mp4)`
   - Size: `1080p · 1920 × 1080` for a landscape 16:9 film
   - Quality: `Great` unless the user specifies otherwise
   - Confirm the first/last exported frames span the entire film.
4. Set the output filename explicitly; the app may remember an earlier name.
   Click `Export MP4`; wait for completion, not just progress to begin.
5. Find the actual output. Browser downloads in the tested host appeared in the
   OS Downloads folder even when Playwright's download event did not resolve.
6. Save a native `.styk` project. Prefer normal Save/Save as; see the recovery
   fallback in the recipes if the browser's native picker is inaccessible.
7. Copy final outputs into the workspace or user-requested output folder.
   Resolve paths for the current machine; never hardcode the earlier user's
   home folder. Do not overwrite existing deliverables without permission.

### Export pitfalls

- A native save picker could stall Save as and Export without a visible error.
  An unused image file chooser also remained active after programmatic import.
  Close/cancel outstanding chooser dialogs before retrying.
- Temporarily disabling `window.showSaveFilePicker` triggered the app's browser
  download fallback for MP4 in the tested session. Use this only for an observed
  picker problem; restore the original property afterward.
- **Export > Project** offered PIV/STKZ/STK/movieclip, not a native STYK animation.
  Do not present a PIV export as the editable native `.styk` project.
- A timeout waiting for `download` is not proof that export failed. Check the
  app's status and the actual file before exporting again.

## Definition of done

- The film follows the story and has been visually previewed.
- The final movie exists, is nonempty, and passes CLI `verify` for the required
  dimensions, duration, frame rate/frame count, and native project metadata.
  The inspector supports the observed STYK header and nonfragmented MP4; it
  fails explicitly on unsupported formats instead of guessing.
- Decode representative MP4 frames with `browser verify-video`. It waits for
  `requestVideoFrameCallback`: `seeked` alone previously returned stale pixels.
  Inspect its optional contact sheet; metadata alone does not prove good motion.
- The native project exists and reopens in StykAnimate with the expected title,
  key count, total duration, scenery, and actor poses.
- When reopening the saved copy, only discard the current editor state after
  confirming it is the same work already saved; never discard unsaved user work.
- Report actual deliverables with file links, duration, resolution, and whether
  audio is included. State any limitations honestly.

## Known successful baseline

The first validated film used a 960 x 540 scene, original lunar PNG scenery,
vector title, one recolored stock figure, and 17 posed keys. After a separate
timing pass it contained 342 playback frames at 24 fps (14.25 seconds). A
1920 x 1080 MP4 was verified, and its native STYK project reopened successfully.
This is evidence for the workflow, not a mandatory story, length, or art style.

The later "Little Paper Boat" film validated dense version-5 JSON import with
1,440 poses, two articulated actors, independent props, PNG art, and fades.
Its 60-second 1080p MP4 and native STYK were checked and reopened. The reusable
tools above generalize that workflow without depending on that film, its files,
the earlier session folder, or a particular user's home path.
