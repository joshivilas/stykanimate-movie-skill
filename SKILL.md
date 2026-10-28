---
name: stykanimate-movie-skill
description: 'Make a short animated film in StykAnimate from a story or simple idea. Use for movies, stick-figure animation, storyboards, animated scenes, natural movement, sound cues, and MP4 or editable STYK exports at app.stykanimate.com. Handle planning, animation, saving, and verification with the bundled Node.js tools.'
argument-hint: 'Describe your story; length, style, and sound are optional'
---

# Make a movie from an idea

The user describes a story. You handle the technical work and deliver a playable
MP4 plus an editable native `.styk` project.

Example request:

> Make a short film about a little robot finding a flower.

## Keep it easy for the user

- Accept a plain-language idea. Do not require JSON, a storyboard, commands,
  frame counts, or knowledge of the editor.
- A copied skill folder is ready to use. Do not require the user to run npm
  setup, install dependencies, or build it. Run the readiness check yourself;
  explain any missing Node.js runtime or browser tools as a specific blocker.
- Use sensible defaults: 10-20 seconds, 24 fps, landscape 16:9, 1080p MP4,
  simple original artwork, and no sound unless requested.
- Follow the user's characters, ending, style, and length. Ask only about
  significant ambiguities, permissions, or a blocker; handle routine creative
  choices yourself.
- Give a brief plan, then make the film. Do not stop at a storyboard when the
  user requested a finished movie.
- Do not replace the user's story with the bundled demo.

## Workflow

1. **Check readiness.** Resolve this skill's installed directory and run
   `node <skill-directory>/scripts/styk-tools.cjs doctor`, quoting paths and
   using native separators. Node.js 24+ is required; no dependencies to install.
   Discover the host's browser tools before calling them. Reuse a shared
   StykAnimate page or open <https://app.stykanimate.com/> and obtain its current
   page ID. Browser and Node must be able to access the selected files.
   If browser automation is unavailable, explain the limitation and offer the
   [manual recipes](./references/browser-recipes.md); do not claim an export.
2. **Protect existing work.** Inspect the page and save/back up any current
   project before starting a new animation or replacing content. Never discard
   unsaved work or overwrite existing deliverables without permission. Run
   mutating operations on one editor page sequentially.
3. **Plan and animate.** Make a compact internal beat sheet with a readable
   setup, action, and ending. Read the [tool guide](./references/tools.md) before
   authoring; reuse the animation library and story-specific choreography
   rather than rebuilding helpers. Validate generated JSON before importing.
   Keep feet grounded, props independently movable, and limbs articulated.
   Dense animation has one key per output frame: do not add UI inbetweens.
4. **Preview and export.** Use the [detailed workflow](./references/workflow.md)
   for scene setup, timing, preview, export, and picker pitfalls. Use bundled
   browser-call generators with the discovered browser tool; they emit
   arguments, not an autonomous browser session. Preview the entire film and
   inspect important contact poses. Save native STYK and export the complete
   MP4 at the requested dimensions, duration, and frame rate.
5. **Verify and deliver.** Run CLI `verify` against explicit expectations,
   decode representative frames with `browser verify-video`, and reopen the
   saved native project to check title, timing, scenery, and poses. Metadata
   alone is not visual verification. Link both actual files and report length,
   resolution, and whether sound is included. State incomplete steps honestly.

## Optional features and troubleshooting

- **Sound requested:** read [production helpers](./references/production.md).
  Use original cues or authorized assets. Audio import is experimental; check
  placement, duration, volume, saved-project reopening, expected MP4 audio-track
  count, and listen to the actual export. A generated WAV is not automatically
  included in the movie. Dialogue/TTS is not bundled.
- **Manual posing, camera, or layers:** consult the
  [detailed workflow](./references/workflow.md) and
  [browser recipes](./references/browser-recipes.md). Camera animation and
  multilayer authoring are outside the toolkit's tested automation scope.
- **Installation:** see the [quick start](./README.md). Phones/tablets are not
  standalone authoring hosts; ARM and remote browser hosts need compatibility
  checks. Do not promise support for untested devices.
