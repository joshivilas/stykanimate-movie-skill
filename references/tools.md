# Reusable StykAnimate tools

## Environment and entry point

Install by copying the entire skill folder into your project's `.github/skills`
directory, then reload the host if needed and describe your film in chat.
See the [quick start](../README.md) for personal and other host locations.
No npm command or build step is required.

For an optional checked installer, run `npm run setup` from the extracted
skill folder for personal Copilot use, or
`npm run setup -- "<skills-directory>"` for another host or project.
The installer refuses to replace an existing skill.

`npm run demo` (CLI `quickstart`) checks the runtime and creates a new
`stykanimate-demo` directory with a validated `movie.json` and `expected.json`.
Both describe a silent 10-second, 24 fps demo with a 1080p export target.
Use `npm run demo -- "<new-directory>"` to choose a destination; its parent
must exist. Existing files or directories are refused. This is a local check,
not browser automation or a video export. No audio is generated or embedded.

`npm run tools -- <command> ...` is shorthand for
`node scripts/styk-tools.cjs <command> ...`. The direct CLI also supports
`setup [skills-directory]` (default: `.copilot/skills` beneath the current
user's home directory) and `quickstart [new-directory]`.
All previous commands and argument formats remain supported.

Use Node.js 24, which includes Zstandard support for native STYK inspection.
No npm packages, Playwright installation, Python, ffmpeg, or local server are
required. The CLI uses the existing browser tool, not a second browser session.

From the workspace root in PowerShell:

```powershell
$tool = '.\.github\skills\stykanimate-movie-skill\scripts\styk-tools.cjs'
node $tool --help
node --test '.\.github\skills\stykanimate-movie-skill\tests\tools.test.cjs'
```

Or, from the installed skill directory on Linux/macOS in Bash/zsh:

```bash
tool="./scripts/styk-tools.cjs"
node "$tool" doctor
npm test
```

The toolkit is shell-independent; examples below using PowerShell are not a
runtime dependency. Resolve absolute paths on the current machine; JSON paths
on Linux/macOS use their native separators instead of Windows drive letters.
Read [production helpers](./production.md) for `doctor`, `storyboard`,
`expectations`, `audio`, `inspect-wav`, `browser inspect-scene`, and experimental
`browser import-audio`. See [installation](../README.md) for host requirements.

Paths below such as `C:\Films` are examples. Use the actual workspace or session
folder; ensure the output directory exists. Do not copy a previous page ID.
All commands report JSON and exit nonzero on errors, except `--help`, which
prints help text. `demo` and `writeMovie` refuse to overwrite an existing file.

## Tool selection

| Task | Tool |
|---|---|
| Start a small working animation | `demo <new-output.json>` |
| Build the user's specific story | Import `scripts/animation.cjs` from a new story script |
| Validate dense JSON before importing | `validate <movie.json>` |
| Convert SVG artwork/text into embedded PNG assets | `browser rasterize-assets <options.json>` |
| Replace a backed-up project with generated JSON/native STYK | `browser import-project <options.json>` |
| Inspect an exact moment | `browser seek <options.json>` |
| Save the native editable project | `browser save-project <options.json>` |
| Export the complete movie | `browser export-mp4 <options.json>` |
| Native picker is inaccessible | `browser picker-mode` enable, save/export, then disable |
| Normal save still fails | `browser recovery-project`, first inspect, then guarded download |
| Check a downloaded file, including an identified `.tmp` | `inspect-mp4` or `inspect-native` |
| Verify both final deliverables against exact requirements | `verify <mp4> <styk> <expected.json>` |
| Check actual decoded frames, optionally make a contact sheet | `browser verify-video <options.json>` |

The browser operations are code generators. Their output has this shape:

```json
{"pageId":"CURRENT_PAGE_ID","code":"return await (...) (page, {...});","timeoutMs":1000}
```

Discover `runPlaywrightCode` through tool search, then pass that output as its
arguments. Do not run the generated browser code with Node, paste it into the
website's console, or add it to the app's source. The generated function is
self-contained and uses the provided `page` object.

## Author a story, not another framework

```powershell
node $tool demo 'C:\Films\Walk and wave.json'
node $tool validate 'C:\Films\Walk and wave.json'
```

The demo is 10 seconds / 240 frames. To make a different film, create a
story-specific CommonJS file using the following pattern. Resolve the library
path relative to that file or pass its absolute path through a CLI argument.

```javascript
const A = require(process.argv[2]); // Absolute path to animation.cjs.
const actor = A.createRig({id: 1, name: 'Hero', color: '#315f63'});
const movie = A.createMovie({
  name: 'A new story', seconds: 8, fps: 24,
  types: [actor.type],
  sample(time) {
    const {pose} = A.walkPose(actor, {
      fromX: 200, toX: 500, start: 0, end: 8, time, ground: 440
    });
    return [A.solveActor(actor, pose, {time}).object];
  }
});
console.log(A.writeMovie(process.argv[3], movie));
```

```powershell
node 'C:\Films\my-story.cjs' (Resolve-Path '.\.github\skills\stykanimate-movie-skill\scripts\animation.cjs').Path 'C:\Films\My film.json'
```

Use the bundled example for a walk followed by a gesture. For a full story,
create named beat intervals and reuse the functions below. Do not bake moving
props into the background. Maintain contact during handoffs using the solved
hand coordinates, and keep each object ID tied to the same figure type.

### Animation API

All coordinates are scene pixels; all joint angles are **absolute radians**.
Image roots are at the image center. Defaults target a 960 x 540, 24 fps film.

| Function | Returns / behavior |
|---|---|
| `createRig({id, name, ...})` | A reusable articulated rig and `.type`; optional torso/head/upper/fore/thigh/shin lengths, width, color, farColor, scarfColor |
| `standing(rig, x, ground, facing=1)` | Pose with hip, torso, head, facing, feet and hands |
| `crouching(rig, {x,ground,height=27,facing=1,lean=20})` | Crouched pose; height is hip height above ground; lean is degrees |
| `carrying(rig, pose, center?, grip=10, offsetY=7)` | New pose holding a prop; does not modify the input pose |
| `walkPose(rig, {fromX,toX,start,end,time,ground,stride=40,lift=11})` | `{pose, contacts}`; planted feet remain fixed in world space during stance |
| `blendPose(a,b,u)` | New pose interpolated at progress 0..1; rejects opposing facing values |
| `track([[time,value],...], {poses=false,easing='smooth'})` | Validated reusable sampling function; values are vectors or poses; easing can also be linear or constant |
| `solveTwoBone(start,target,l1,l2,side=1)` | `{joint,end,angles}`; rejects unreachable targets rather than silently stretching/clamping |
| `solveActor(rig, pose, {id=rig.id,time=0,flutter=0})` | `{object,neck,headTop,hands,feet}`; builds editable joint angles and eye/scarf poses |
| `heldCenter(solvedActor, offsetY=-7)` | Center for a prop held in both solved hands |
| `segment(id,parent,length,width,color,name,kind='line')` | Line or `circleFill` segment |
| `figureType(id,name,segments)` | Editable native-compatible figure type |
| `imageType(id,name,renderedAsset)` | PNG image type using the asset's scene size, pixel size, and data URL |
| `object({id,typeId,x,y,angles,scale=1,opacity=1,lengths?})` | One instance; correctly encodes opacity in `field28`, not an ignored generic opacity field |
| `createMovie({name,width=960,height=540,fps=24,seconds,types,sample})` | Dense version-5 JSON; samples each output frame, assigns slots/draw order, validates data |
| `validateMovie(movie)` | `{frames,fps,seconds,types,objects}` or throws |
| `writeMovie(file,movie,{overwrite=false})` | Validates and writes; explicit opt-in required to overwrite |

Also exported: `smooth`, `mix`, `mixPoint`, and `radians`.

Important constraints:

- Rig dimensions are adjustable, but helpers are not a universal anatomy solver.
  `solveActor` will reject a hand/foot target outside the chosen limb lengths.
  Fix the choreography or root position; do not catch and ignore the error.
- Locomotion holds planted feet exactly. Blending unrelated standing/walking
  poses can introduce foot sliding; match the transition's contact pose and
  inspect it visually. Do not blindly ease every stride to a stop.
- Turning is choreography, not a sign flip. Author a transition with appropriate
  foot lifts and near-straight limbs before switching facing/bend direction.
- The eye follows the neck position, not a sophisticated facial rig. Modify or
  extend the rig if the story needs more expressive head/eye acting.
- Tracks require increasing times and return fresh values. Keep rotation values
  unwrapped if an object intentionally spins.
- Object array order is back to front. Keep backgrounds first and fade overlays
  last. Keep stable IDs, even when an object becomes transparent.
- `createMovie` requires an exact whole number of frames. It writes one key per
  frame (`duration_raw=1`), including a constant final key. Do not add inbetweens.
- A generated JSON project is **not** the native STYK deliverable. Import and save
  it in StykAnimate; do not rename JSON to `.styk`.

## Browser options

Create an options JSON file with `pageId` plus the fields for one operation.
On Windows, escape backslashes in JSON. The generated call uses the current tool
schema but the agent must still discover the tool before submitting it.

### Art conversion: `rasterize-assets`

Input asset manifest:

```json
{
  "sky": {
    "w": 960,
    "h": 540,
    "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"960\" height=\"540\"><rect width=\"960\" height=\"540\" fill=\"#ecf2e9\"/></svg>"
  }
}
```

Options:

```json
{"pageId":"CURRENT_PAGE_ID","file":"C:\\Films\\art-source.json","ratio":2,"outputName":"art-rendered.json"}
```

The downloaded manifest contains `w`, `h`, `pixelWidth`, `pixelHeight`, and
`data_url` for each asset; load it with Node and pass entries to `imageType`.
Use self-contained SVG (including gradients and bundled/system font text).
External references, scripts, and foreignObject are rejected. Fonts must be
available in the browser; rasterization makes the result portable afterward.
Ratio is 1..4; each raster is limited to 16 megapixels.

### Safe import: `import-project`

```json
{"pageId":"CURRENT_PAGE_ID","file":"C:\\Films\\My film.json","projectName":"My film","expectedKeys":1440,"replaceCurrent":true}
```

Back up the current project first. The operation refuses an **Edited** project
and never clicks **Don't save**. It creates a fresh animation before import so
reimporting the same filename cannot falsely pass a stale-title check. It clears
the file input, imports, waits for the new name, selects Simple mode, and checks
the key count. JSON imports use the filename stem as the displayed name; native
imports use their saved title. `expectedKeys` is not the sparse movie's expanded
playback frame count.

If the title is **Edited** after a verified save, manually reopen the saved copy
and handle the unsaved-changes dialog only after verifying nothing will be lost.

### Seek: `seek`

```json
{"pageId":"CURRENT_PAGE_ID","frame":889}
```

Uses the timecode's Go to frame dialog and a 1-based playback frame number.
At 24 fps, 37 seconds is frame 889. Avoid hundreds of Next-frame clicks.

### Save: `save-project`

```json
{"pageId":"CURRENT_PAGE_ID"}
```

Triggers File > Save as. A result of `save-requested` is not proof of a saved file.
Use the browser dialog tool if required, locate the download, and inspect it.

### Export: `export-mp4`

```json
{"pageId":"CURRENT_PAGE_ID","projectName":"My film","name":"My film","frames":1440,"size":"1080p · 1920 × 1080"}
```

Name omits the extension. This checks the open project and last exported frame,
sets MP4/Great/full-range output and the filename, and waits for the render dialog
to close. Supported size labels also include `720p · 1280 × 720` and
`Original · 960 × 540`. Other sizes require a targeted manual UI change.
If the range does not match, the helper stops instead of silently cropping.

The result is `render-dialog-closed`, not a promise that a file exists. Verify
the file on disk. If a native save picker prevents rendering, cancel it with
the browser dialog tool and use the next operation.

### Inaccessible native picker: `picker-mode`

```json
{"pageId":"CURRENT_PAGE_ID","enabled":true}
```

Only for a diagnosed native picker problem. This backs up the page's original
`showSaveFilePicker` property and activates the app's download fallback. After
save/export completes, call again with `enabled:false` to restore it exactly.
Do not run concurrent operations on that page. Restore even if export fails.

### Last-resort native save: `recovery-project`

First inspect, without downloading:

```json
{"pageId":"CURRENT_PAGE_ID","projectName":"My film","download":false}
```

Then download only if the record is fresh:

```json
{"pageId":"CURRENT_PAGE_ID","projectName":"My film","download":true,"minimumSavedAt":1792590000000,"outputName":"My film.styk"}
```

Replace the example epoch with the timestamp of the **latest content edit** in
the current session, not a timestamp copied from a previous film. The tool fails
on missing, ambiguous, stale, or differently encoded records. Recovery is read
only; it never writes private app state. A newly imported project might not have
a recovery record yet. Prefer normal Save as; do not assume import creates one.

### Decode actual output: `verify-video`

```json
{"pageId":"CURRENT_PAGE_ID","file":"C:\\Films\\My film.mp4","width":1920,"height":1080,"seconds":60,"fps":24,"times":[2,8,15,25,37,44,52,58],"contactSheet":"My film - check.png"}
```

Loads the local file with a temporary file input; no upload or external service.
Verifies decoded dimensions/duration and samples actual presented frames via
`requestVideoFrameCallback`. It returns the presented timestamps and optionally
downloads a labeled contact sheet. Inspect that image for unwanted overlaps,
missing props, and bad poses.

Times must target distinct frames, from frame 2 through the frame before the
duration endpoint. Up to 24 samples are allowed. `seeked` alone is not sufficient:
it returned the previous frame's pixels during production. Aborted blob range
requests during seeks/cleanup can be normal; the helper checks decoder events
and presented timestamps, not the network log alone.

## Final verification

Create `expected.json` for the current film:

```json
{
  "video": {"width":1920,"height":1080,"fps":24,"frames":1440,"seconds":60},
  "project": {
    "name":"My film","width":960,"height":540,"fps":24,"frames":1440,
    "typeNames":["Hero","Paper boat"]
  }
}
```

```powershell
node $tool verify 'C:\Films\My film.mp4' 'C:\Films\My film.styk' 'C:\Films\expected.json'
```

This checks exact dimensions and frame counts, duration/FPS to 0.001 tolerance,
constant video frame timing, independent audio/video sample tables, native
timeline duration, title, and expected figure types.
Set optional `video.audioTracks` to the required nonnegative integer count;
generated expectations always include it. Listen to sound separately.

The native inspector supports the observed STYK header revision and its first
Zstandard-compressed JSON block, up to 128 MiB decoded. It is read-only and does
not claim to validate every embedded asset or checksum. Always reopen the STYK
in the app. The MP4 inspector supports ordinary, nonfragmented MP4 with one video
track; unsupported formats fail explicitly. It is not a substitute for decoding
video and visually checking motion.

Downloads may use a remembered filename or an intermediate `.tmp`. Do not
blindly copy the newest file in Downloads. Identify the file created by this
export, inspect the MP4 structure, and confirm it is complete before promoting it
to the requested filename. Leave browser-owned in-progress downloads alone.
Never report success just because the export dialog disappeared.
