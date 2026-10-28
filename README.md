# StykAnimate movie skill

**Describe a story. Let your agent make the film.**

Create a short animation at [StykAnimate](https://app.stykanimate.com/) and get
both a playable **MP4** and an editable **STYK project**.

> Make a 10-second film about a robot finding a flower. Save the editable
> project and a 1080p MP4.

You do not need to write code, prepare JSON, or learn the animation tools.
The agent handles planning, animation, preview, export, and verification.

## 1. Copy the skill into your project

1. Download and extract the release ZIP.
2. Copy the **entire `stykanimate-movie-skill` folder** into your project's
   `.github/skills` directory. Create that directory if it does not exist.
3. Reload your agent host if the skill does not appear.

The result should look like this:

```text
your-project/
  .github/
    skills/
      stykanimate-movie-skill/
        SKILL.md
        scripts/
        references/
        examples/
        ...other bundled files
```

**No terminal command, npm install, or build step is required.** Do not copy
only `SKILL.md`: the agent also uses the bundled scripts and references.
If the skill folder already exists, back it up before replacing it; do not
blindly merge versions.

For personal Copilot use across projects, copy the folder into `.copilot/skills`
beneath your home directory instead. Other hosts may use `.agents/skills` or
`.claude/skills`; use the location supported by your host.

To **make films**, the agent still needs **Node.js 24+** to run the bundled
helpers and host-provided browser automation tools to operate StykAnimate.
These are runtime requirements, not installation steps for the skill.
No npm dependencies, API key, Python, ffmpeg, or separate Playwright
installation is needed. The skill does not install browser tools.

## 2. Describe your film

Invoke `/stykanimate-movie-skill` in chat, or say:

> Use stykanimate-movie-skill to make a short film about a paper boat helping
> a lost firefly.

A story idea is enough. Length, style, and sound are optional.
Unless you specify otherwise, the agent aims for **10-20 seconds, 24 fps,
landscape 1080p, and no sound**. It asks before discarding unsaved work or
overwriting your files.

You can also ask for changes:

> Make the ending slower and have the robot wave.

## Optional developer tools

Normal use needs no npm commands. If you prefer a checked installer instead
of copying the folder, run this from the extracted skill folder:

```text
npm run setup
```

It validates the runtime and package, installs into your personal Copilot
skills directory, and refuses to replace an existing installation. Use
`npm run setup -- "<skills-directory>"` to choose another destination.
Quote paths with spaces and use native path separators.

To generate a local demo from the extracted or installed skill folder:

```text
npm run demo
```

This creates a new `stykanimate-demo` folder containing validated animation
JSON and export expectations for a silent 10-second film. It refuses to
overwrite an existing folder. Use `npm run demo -- "<new-output-directory>"`
to choose another location whose parent exists.

Then ask your agent:

> Import the generated movie.json into a backed-up StykAnimate page, preview
> it, save an editable STYK project, export a silent 1080p MP4, and verify
> both using expected.json.

The local demo does **not** operate the browser or produce a video by itself.
Generated JSON is not a native STYK project.

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm` for these
optional commands. No execution-policy change is needed.

## Limits worth knowing

- Without host browser tools, use the [manual recipes](./references/browser-recipes.md);
  automatic movie creation is unavailable.
- Requested sound uses original cues or authorized assets. Audio import is
  experimental and must be checked by listening to the exported movie.
  Generating a WAV does not embed it in the film. Dialogue/TTS is not bundled.
- Camera animation and multilayer authoring require manual editor work.
- Windows is tested locally. Linux/macOS have portable code and CI configuration,
  but must pass CI and browser acceptance before being called verified.
- Phones/tablets are not standalone authoring hosts. ARM compatibility is not
  verified. Remote/SSH/container hosts need explicit shared file access or transfer.
- Existing work must be saved before replacement. Never run simultaneous
  mutating operations on the same editor page.

**Status: v0.1.0 release candidate.** Unit tests do not replace live browser,
visual, or listening checks. This is an independent community toolkit, not
an official StykAnimate product; the website and its assets are not bundled.

## Advanced use and contributing

All existing CLI commands remain available:

```text
npm run tools -- --help
npm test
npm run check
```

- [Agent workflow](./SKILL.md) and [detailed editor workflow](./references/workflow.md)
- [Tool API and verification](./references/tools.md)
- [Storyboards, export specs, and sound](./references/production.md)
- [Publishing](./PUBLISHING.md), [contributing](./CONTRIBUTING.md),
  [release history](./CHANGELOG.md), and [MIT license](./LICENSE)

Release packaging uses an explicit allowlist. Your films, recordings,
credentials, and session files are not included. Inspect archives before sharing.
