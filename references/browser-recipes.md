# Tested browser recipes

Prefer the reusable browser operations in [the tool guide](./tools.md).
These snippets are fallbacks for a changed UI or a small manual edit, not a
reason to recreate the bundled helpers. Use the toolkit's dense authoring path
for complex motion; the keyframe timing recipes below apply only to sparse keys.

Use these inside the browser tool's Playwright execution context, where `page`
is supplied. Discover the tool first and use its actual schema. Snippets are
templates: replace story-specific content and coordinates. Do not execute this
file as a standalone Node.js script.

Do not reuse accessibility snapshot refs across sessions. Prefer role/name
locators; reacquire a snapshot only when a locator no longer matches.

## Rename and edit numeric values

```javascript
await page.getByRole('menuitem', { name: 'File', exact: true }).click();
await page.getByRole('menuitem', {
  name: 'Rename project…', exact: true
}).click();
await page.getByRole('textbox', {
  name: 'Name your project', exact: true
}).fill('Your film title');
await page.getByRole('button', { name: 'Save name', exact: true }).click();

async function setNumber(name, value) {
  const input = page.getByRole('spinbutton', { name, exact: true });
  await input.fill(String(value));
  await input.press('Enter');
}
```

Filling alone may not commit a numeric edit. Use Enter, then await the expected
UI state when a later operation depends on it.

## Select roots/joints in scene coordinates

The app uses canvas hit-testing, not DOM elements for individual figures.
Screenshots may be in device pixels; Playwright mouse coordinates are CSS pixels.
Never derive mouse coordinates directly from an image without accounting for it.

Observed DOM: `#viewport`, `#artboard`, `#scene`, `#overlay`.
The artboard's bounding box supplies the scene-to-screen transform.

```javascript
async function clickScene(x, y, sceneWidth = 960, sceneHeight = 540) {
  const r = await page.locator('#artboard').boundingBox();
  if (!r) throw new Error('Scene artboard is not visible');
  await page.mouse.click(
    r.x + x * r.width / sceneWidth,
    r.y + y * r.height / sceneHeight
  );
}

// Example only: this must be the CURRENT actor root location.
await clickScene(190, 365);
await page.getByRole('heading', {
  name: 'Figure Blue', exact: true
}).waitFor();
await setNumber('X (px)', 235);
await setNumber('Y (px)', 361);
```

Recalculate the bounding box after workspace/panel/zoom changes. In the tested
stock Blue figure, root selection showed Figure Blue; clicking limb handles
showed headings such as Joint Torso, Joint Left upper arm, Joint Right upper arm.
The default root was (480,280), torso length 78, upper-arm length 53. These are
observations of that rig only, not universal coordinates for all figures.

After clicking a joint, wait for the correct heading before setting its angle.
After returning to a root, wait for `X (px)` to appear. Both joint and figure
panels expose `Angle (degrees)`; editing the wrong one can distort the motion.

## Recolor a selected figure

The observed color textbox was a native `input[type=color]`, not a normal text
input. Set its value and dispatch the same input/change events:

```javascript
await page.getByRole('textbox', {
  name: 'Recolor all segments', exact: true
}).evaluate(input => {
  input.value = '#ffd166';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
```

Verify the color swatch and rendered actor afterward.

## Add vector text

```javascript
await page.getByRole('button', {
  name: 'Add to the scene', exact: true
}).click();
await page.getByRole('menuitem', { name: 'Text…', exact: true }).click();
await page.getByRole('textbox', { name: 'Text', exact: true }).fill('FILM TITLE');
await page.getByRole('spinbutton', {
  name: 'Size · px', exact: true
}).fill('44');
await page.getByRole('checkbox', { name: 'Bold', exact: true }).check();
await page.getByRole('button', { name: 'Create text', exact: true }).click();
await setNumber('X (px)', 70);
await setNumber('Y (px)', 68);
```

Text uses bundled Noto Sans and is saved as portable vector outlines.
Use `Edit text…` for an existing text figure, not a duplicate text overlay.

## Import original scenery without Node Buffer

Prefer an ordinary file chooser for an existing local image. For generated art,
the following creates a real PNG File entirely inside the page and supplies it
to the app's image input. It avoids `Buffer`, which was undefined in the browser
tool's execution environment.

```javascript
await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is unavailable');
  const sky = ctx.createLinearGradient(0, 0, 0, 540);
  sky.addColorStop(0, '#070f29');
  sky.addColorStop(1, '#253b62');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 960, 540);
  // Replace this minimal scenery with the story's original artwork.
  ctx.fillStyle = '#38546e';
  ctx.fillRect(0, 440, 960, 100);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('PNG encoding failed');
  const input = document.querySelector(
    'input[type=file][accept="image/png,image/jpeg,image/gif,image/bmp,image/webp"]'
  );
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Expected StykAnimate image importer was not found');
  }
  const transfer = new DataTransfer();
  transfer.items.add(new File([blob], 'Scenery.png', { type: 'image/png' }));
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.getByRole('heading', {
  name: 'Figure Scenery', exact: true
}).waitFor();
await page.getByRole('button', { name: 'Back', exact: true }).click();
```

Opening **Add > Image...** first may leave a native chooser outstanding. Use
the browser dialog tool to cancel the unused chooser after programmatic import.
Do not mistake the lingering chooser for an import failure.

## Keyframe construction and final timing

Construct poses with `Add Frame`. Set actor transforms only after confirming
root selection. Reuse actors across keys instead of making new disconnected
figures for every pose.

For final timing, navigate to the last key with Timeline menu > Last frame.
Set its inbetweens/easing, then walk backward. Do not rely on offscreen frame
options: the frame strip is virtualized.

```javascript
// Example for a THREE-key film already constructed, with the last key selected.
// Replace with the actual shot plan. Count = 48 + 24 + 48 = 120 frames, 5 seconds.
const timingLastToFirst = [
  { key: 3, inbetweens: 47, easing: 'Constant' },
  { key: 2, inbetweens: 23, easing: 'Ease out' },
  { key: 1, inbetweens: 47, easing: 'Constant' }
];
for (const beat of timingLastToFirst) {
  const summary = await page.getByRole('group', {
    name: 'Frame', exact: true
  }).first().innerText();
  if (!summary.includes(`Frame ${beat.key} of `)) {
    throw new Error(`Wrong selected key; expected ${beat.key}: ${summary}`);
  }
  await setNumber('Frame inbetweens', beat.inbetweens);
  await page.getByRole('combobox', {
    name: 'Frame easing', exact: true
  }).selectOption({ label: beat.easing });
  if (beat.key > 1) {
    await page.getByRole('button', {
      name: 'Timeline menu', exact: true
    }).click();
    await page.getByRole('menuitem', {
      name: 'Previous key', exact: true
    }).click();
  }
}
```

Avoid changing key counts after this pass. If you must, redo and verify timings.

## Export and native picker fallback

```javascript
await page.getByRole('button', { name: 'Export', exact: true }).click();
await page.getByRole('radio', { name: 'Video', exact: true }).check();
await page.getByRole('combobox', {
  name: 'Export format', exact: true
}).selectOption({ label: 'MP4 (.mp4)' });
await page.getByRole('combobox', {
  name: 'Size', exact: true
}).selectOption({ label: '1080p · 1920 × 1080' });
// Check first/last frame fields and the summary before starting.
await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
```

If a native save dialog blocks progress and the tool cannot handle it, temporarily
remove `showSaveFilePicker` to let the app use its download fallback:

```javascript
// Run only for a diagnosed native picker problem, before retrying export.
await page.evaluate(() => {
  if (Object.prototype.hasOwnProperty.call(window, '__stykSkillPickerBackup')) {
    throw new Error('Picker fallback already active');
  }
  window.__stykSkillPickerBackup = Object.getOwnPropertyDescriptor(
    window, 'showSaveFilePicker'
  );
  Object.defineProperty(window, 'showSaveFilePicker', {
    value: undefined, configurable: true, writable: true
  });
});
```

Restore after export completes:

```javascript
await page.evaluate(() => {
  if (!Object.prototype.hasOwnProperty.call(window, '__stykSkillPickerBackup')) {
    throw new Error('No picker backup to restore');
  }
  const descriptor = window.__stykSkillPickerBackup;
  if (descriptor) Object.defineProperty(window, 'showSaveFilePicker', descriptor);
  else delete window.showSaveFilePicker;
  delete window.__stykSkillPickerBackup;
});
```

The app rendered 342 frames at 1080p in roughly 10 seconds in the tested session;
this is not a timeout guarantee. If a tool returns a deferred-result ID, continue
that execution with the ID instead of submitting the export again.

Use current OS Downloads paths and check filename, size, and modification time.
Do not assume `waitForEvent('download')` resolves in every browser host.

## Native project recovery fallback

Prefer File > Save/Save as. If those remain blocked, the tested app stored its
autosaved native project in IndexedDB:

- Database: `stykanimate-recovery`, observed version 2
- Object store: `documents`
- Record fields: `name`, `savedAt`, `token`, `data`
- `data`: ArrayBuffer containing native STYK bytes, not text or a Blob
- Another store, `metadata`, exists; do not modify either store.

This is an implementation-dependent fallback, not a supported public API.
Only use the current project's record. Inspect its timestamp/size first and
ensure autosave includes the last content edit. If there are duplicate names,
require an unambiguous current record rather than picking the first entry.

```javascript
return await page.evaluate(async expectedName => {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('stykanimate-recovery');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  let records;
  try {
    records = await new Promise((resolve, reject) => {
      const request = db.transaction('documents', 'readonly')
        .objectStore('documents').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
  const matches = records.filter(record => record.name === expectedName);
  if (matches.length !== 1) throw new Error('Current recovery record is ambiguous');
  const record = matches[0];
  if (!(record.data instanceof ArrayBuffer)) {
    throw new Error('Recovery format changed; expected ArrayBuffer');
  }
  if (new TextDecoder().decode(record.data.slice(0, 4)) !== 'STYK') {
    throw new Error('Recovery data is not a native STYK project');
  }
  // First run: return these facts and verify freshness BEFORE downloading.
  return {
    name: record.name, savedAt: record.savedAt,
    bytes: record.data.byteLength, token: record.token
  };
}, 'Your film title');
```

After checking freshness, repeat the same read and guards, then replace the
final metadata return with:

```javascript
const url = URL.createObjectURL(new Blob([record.data], {
  type: 'application/octet-stream'
}));
const anchor = document.createElement('a');
anchor.href = url;
anchor.download = 'Your film title.styk';
anchor.click();
setTimeout(() => URL.revokeObjectURL(url), 60000);
return { name: anchor.download, bytes: record.data.byteLength };
```

Never decode/reencode the compressed project as text, write directly to the
recovery database, or change internal application state to fake an animation.
Exporting the app's saved native bytes preserves the project actually created.

## Reopen and validate

Use File > Open project... and its file chooser, or the observed project input:

```javascript
await page.locator(
  'input[type=file][accept=".styk,.stykmov,.stkz,.piv,.stk,.json,.nodes,.nodemc,.stknds,.zip,.png,.jpg,.jpeg,.gif,.bmp,.webp"]'
).setInputFiles(absoluteProjectPath);
```

An unsaved-changes dialog may appear. Confirm the existing edits are already in
the saved project before choosing `Don't save`. Verify title `Saved`, timeline
key count, duration, and visuals after import.

For playback, `#playback-fps` reported the live frame rate. This proves playback
is active, not that every exported frame is correct. Inspect representative
poses and independently verify the video file's metadata.

For exported video stills, use `browser verify-video`. Its
`requestVideoFrameCallback` check avoids stale canvas images observed when
drawing immediately after `seeked`. The generated calls and Node validators
are maintained in the toolkit rather than copied into every new story script.
