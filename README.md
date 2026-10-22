# StykAnimate movie skill

A reusable agent skill for turning an original story into an animated film at
[app.stykanimate.com](https://app.stykanimate.com/), with a playable MP4 and an
editable native STYK project.

Includes articulated rigs, planted-foot walking, inverse kinematics, pose tracks,
PNG assets, frame-accurate storyboards, original sound cues, browser-call
generators, media inspectors, safe installation, and release ZIP packaging.

**Status: v0.1.0 release candidate.** Toolkit tests run locally on Windows.
Linux/macOS CI is provided but must pass before claiming those platforms are
verified. Live browser validation is separate from unit tests.

This is an independent community toolkit, not an official StykAnimate product.
The website, its software, and its assets are not distributed or licensed here.

## Requirements and supported devices

- Windows, Linux or macOS with **Node.js 24 or newer**.
- An agent host that supports `SKILL.md` discovery (for example VS Code Copilot).
- A modern browser and internet access to StykAnimate.
- For automation: host-provided browser tools capable of executing Playwright
  snippets against a `page` and accessing selected local files.
  The toolkit does not install a browser, MCP server, or Playwright.
- Without those tools: use the [manual recipes](./references/browser-recipes.md).

No npm dependencies, Python, ffmpeg, API key, or platform-specific shell helper
is needed. Node scripts use portable filesystem APIs. Browser tools and Node
must see the same files; remote/SSH/container hosts need an explicit file transfer
or browser-local path. Native save dialogs and Downloads folders differ by host.

**Not a promise of every device:** phones/tablets are not standalone authoring
hosts for this Node toolkit. ARM devices require an available Node 24 runtime,
compatible agent/browser host, and codec support; they have not been tested here.

## Install

Download a release ZIP, extract it, and open a terminal in the extracted
`stykanimate-movie-skill` directory. These commands work in PowerShell, Bash and zsh:

```text
node --version
node scripts/styk-tools.cjs doctor
npm test
node scripts/release.cjs install "<destination-project>/.github/skills"
```

Replace the destination with an actual path, using native path separators.
Quote paths with spaces. The installer creates `stykanimate-movie-skill` beneath
the destination and refuses to replace an existing installation.

For a personal installation instead:

PowerShell:

```powershell
node .\scripts\release.cjs install (Join-Path $HOME '.copilot\skills')
```

Bash/zsh on Linux/macOS:

```bash
node scripts/release.cjs install "$HOME/.copilot/skills"
```

For other hosts, select their supported skills directory, such as
`.agents/skills` or `.claude/skills`. Discovery and browser tooling depend on the
host; no universal MCP/browser adapter is bundled.
Reload the host and invoke `/stykanimate-movie-skill`, or request:

> Use stykanimate-movie-skill to make a 10-second silent film of a character walking
> to a friend and waving. Save the editable project and a 1080p MP4.

See [SKILL.md](./SKILL.md) for the complete film workflow.

## First local smoke test

Run from the skill directory. `demo.json`, `plan.json`, `expected.json` and
`soundtrack.wav` must not already exist.

```text
node scripts/styk-tools.cjs demo demo.json
node scripts/styk-tools.cjs validate demo.json
node scripts/styk-tools.cjs storyboard examples/storyboard.json plan.json
node scripts/styk-tools.cjs expectations demo.json examples/export-options.json expected.json
node scripts/styk-tools.cjs audio examples/soundtrack.json soundtrack.wav
node scripts/styk-tools.cjs inspect-wav soundtrack.wav
```

Windows users can use backslashes in these relative paths. The demo and sound
are 10 seconds long. The WAV is optional and is **not** automatically embedded
in the movie. The export options default to zero audio tracks; set
`audioTracks: 1` only after adding audio in the app.

Next, have the agent import the demo into a **backed-up** StykAnimate page,
preview, save STYK, export MP4, and verify with `expected.json`. Generated JSON
is not native STYK. Browser commands emit tool-call arguments; Node does not
drive the website by itself.

## What is verified, and what is not

| Surface | Status |
|---|---|
| Rigs, IK, dense JSON, timing, file parsing | Automated regression tests |
| Installation and deterministic ZIP packaging | Automated regression tests |
| Existing silent import/save/export workflow | Prior browser-validated baseline; UI can change |
| Scene inspection | Read-only browser helper; live app smoke-tested on Windows |
| WAV synthesis and PCM16 inspection | Automated regression tests |
| Audio import helper | Experimental; selectors observed, end-to-end release test required |
| Audio quality / actual exported sound | Must be listened to; track count alone is insufficient |
| Linux/macOS | Portable implementation and CI configuration, not locally executed |
| Camera animation, multilayer authoring, dialogue/TTS | Manual app workflow, not automated here |

Existing work is never intentionally discarded. Read safeguards before using
replacement import, picker fallbacks, or recovery. Do not run simultaneous
mutating operations against one editor page.

## Sharing and contributing

- [Publishing checklist and commands](./PUBLISHING.md)
- [Tool API, browser options and verification](./references/tools.md)
- [Production helpers and audio](./references/production.md)
- [Contribution and testing rules](./CONTRIBUTING.md)
- [Release history](./CHANGELOG.md)
- [MIT license](./LICENSE)

Only the skill's explicit file allowlist is packaged; workspace movies, sound
recordings, credentials and previous session files are not included. Inspect
the archive before publishing. Original user films are not release assets.
