'use strict';

const path = require('node:path');

async function inspectScene(page) {
  const origin = await page.evaluate(() => window.location.origin);
  if (origin !== 'https://app.stykanimate.com') throw new Error('Expected the StykAnimate application');
  const artboard = await page.locator('#artboard').boundingBox();
  if (!artboard) throw new Error('StykAnimate artboard is not visible');
  return {
    title: await page.title(), url: page.url(), artboard,
    edited: await page.getByRole('button', { name: / Edited$/ }).count() > 0,
    audioPanelOpen: await page.getByRole('region', { name: 'Audio timeline', exact: true }).count() > 0,
    fileInputs: await page.locator('input[type=file]').evaluateAll(inputs => inputs.map(input => ({ accept: input.accept, multiple: input.multiple })))
  };
}
async function importAudio(page, options) {
  const saved = page.getByRole('button', { name: `${options.projectName} Saved`, exact: true });
  const edited = page.getByRole('button', { name: `${options.projectName} Edited`, exact: true });
  if (!(await saved.count()) && !(await edited.count())) throw new Error('The expected project is not open');
  if (await page.getByRole('button', { name: 'Pause', exact: true }).count()) await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Audio timeline', exact: true });
  if (!(await panel.count())) await page.getByRole('button', { name: 'Audio', exact: true }).click();
  await panel.waitFor();
  const clips = page.getByRole('region', { name: 'Audio clips', exact: true });
  const labels = await clips.getByRole('button').allTextContents();
  if (labels.some(label => label.trim() === options.clipName)) throw new Error('A clip with this name already exists; inspect before retrying');
  const input = page.locator('input[type=file][accept=".wav,.mp3,.m4a,.aac,.flac,.ogg,.opus,.aif,.aiff,audio/*"]');
  await input.setInputFiles([]);
  await input.setInputFiles(options.file);
  await clips.getByRole('button').filter({ hasText: options.clipName }).waitFor({ timeout: 30000 });
  return { status: 'clip-visible', clipName: options.clipName, next: 'Inspect start time, duration, volume and playback; save native STYK and verify audio in the exported MP4.' };
}
async function importProject(page, options) {
  if (!options.replaceCurrent) throw new Error('Confirm the current project is backed up with replaceCurrent:true');
  if (await page.getByRole('button', { name: / Edited$/ }).count()) throw new Error('Save the current edits before importing; this tool never discards them');
  if (await page.getByRole('button', { name: 'Pause', exact: true }).count()) await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'New animation', exact: true }).click();
  await page.getByRole('button', { name: 'Untitled animation Saved', exact: true }).waitFor({ timeout: 15000 });
  const input = page.locator('input[type=file][accept=".styk,.stykmov,.stkz,.piv,.stk,.json,.nodes,.nodemc,.stknds,.zip,.png,.jpg,.jpeg,.gif,.bmp,.webp"]');
  await input.setInputFiles([]);
  await input.setInputFiles(options.file);
  await page.getByRole('button', { name: `${options.projectName} Saved`, exact: true }).waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Simple', exact: true }).click();
  const summary = await page.getByRole('group', { name: 'Frame', exact: true }).first().innerText();
  const total = Number(summary.match(/Frame\s+[\d,]+\s+of\s+([\d,]+)/)?.[1].replaceAll(',', ''));
  if (total !== options.expectedKeys) throw new Error(`Imported key count mismatch: expected ${options.expectedKeys}; ${summary}`);
  return { project: options.projectName, keys: total, summary };
}
async function seekFrame(page, options) {
  if (await page.getByRole('button', { name: 'Pause', exact: true }).count()) await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: /^\d{2}:\d{2}:\d{2}$/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Go to frame', exact: true });
  const total = Number((await dialog.innerText()).match(/of\s+([\d,]+)/)?.[1].replaceAll(',', ''));
  if (!Number.isFinite(total) || options.frame > total) throw new Error(`Frame ${options.frame} is outside the timeline (${total})`);
  await page.getByRole('spinbutton', { name: 'Go to frame', exact: true }).fill(String(options.frame));
  await page.getByRole('button', { name: 'Go', exact: true }).click();
  return { frame: options.frame, total };
}
async function pickerMode(page, options) {
  return await page.evaluate(enabled => {
    const key = '__stykanimateSkillPickerBackup';
    if (enabled) {
      if (Object.prototype.hasOwnProperty.call(window, key)) throw new Error('Download fallback is already active');
      window[key] = { descriptor: Object.getOwnPropertyDescriptor(window, 'showSaveFilePicker') };
      Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true });
      return { downloadFallback: true, restoreRequired: true };
    }
    if (!Object.prototype.hasOwnProperty.call(window, key)) throw new Error('No picker backup exists on this page');
    const { descriptor } = window[key];
    if (descriptor) Object.defineProperty(window, 'showSaveFilePicker', descriptor);
    else delete window.showSaveFilePicker;
    delete window[key];
    return { downloadFallback: false, restored: true };
  }, options.enabled);
}
async function saveProject(page) {
  if (await page.getByRole('button', { name: 'Pause', exact: true }).count()) await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Save as…', exact: true }).click();
  return { status: 'save-requested', next: 'Handle any native dialog, verify the downloaded STYK file, then reopen it. Do not infer persistence from this response.' };
}
async function exportMp4(page, options) {
  if (await page.getByRole('button', { name: 'Pause', exact: true }).count()) await page.getByRole('button', { name: 'Pause', exact: true }).click();
  const saved = page.getByRole('button', { name: `${options.projectName} Saved`, exact: true });
  const edited = page.getByRole('button', { name: `${options.projectName} Edited`, exact: true });
  if (!(await saved.count()) && !(await edited.count())) throw new Error('The expected project is not open');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('radio', { name: 'Video', exact: true }).check();
  await page.getByRole('combobox', { name: 'Export format', exact: true }).selectOption({ label: 'MP4 (.mp4)' });
  await page.getByRole('combobox', { name: 'Size', exact: true }).selectOption({ label: options.size });
  await page.getByRole('radio', { name: 'Great', exact: true }).check();
  await page.getByRole('textbox', { name: 'File name', exact: true }).fill(options.name);
  const last = Number(await page.getByRole('textbox', { name: 'Last frame', exact: true }).inputValue());
  if (last !== options.frames) throw new Error(`Export range ends at ${last}, expected ${options.frames}; inspect the range before proceeding`);
  await page.getByRole('textbox', { name: 'First frame', exact: true }).fill('1');
  await page.getByRole('textbox', { name: 'First frame', exact: true }).press('Tab');
  await page.getByRole('button', { name: 'Export MP4', exact: true }).click();
  const progress = page.getByRole('dialog', { name: 'Exporting animation', exact: true });
  await progress.waitFor({ state: 'visible', timeout: 15000 });
  await progress.waitFor({ state: 'hidden', timeout: 300000 });
  return { status: 'render-dialog-closed', requestedFile: `${options.name}.mp4`, next: 'Verify the actual downloaded file with the CLI and verify-video. A closed dialog alone does not prove success.' };
}
async function rasterizeAssets(page, options) {
  await page.evaluate(() => {
    if (document.getElementById('styk-tool-assets')) throw new Error('Another asset operation is active');
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'styk-tool-assets'; input.hidden = true;
    document.body.appendChild(input);
  });
  try {
    await page.locator('#styk-tool-assets').setInputFiles(options.file);
    return await page.evaluate(async opts => {
      const file = document.getElementById('styk-tool-assets').files[0];
      const assets = JSON.parse(await file.text());
      if (!assets || Array.isArray(assets) || !Object.keys(assets).length) throw new Error('Asset manifest must be a nonempty object');
      for (const [name, asset] of Object.entries(assets)) {
        if (!asset || !Number.isInteger(asset.w) || !Number.isInteger(asset.h) || asset.w <= 0 || asset.h <= 0 || typeof asset.svg !== 'string') throw new Error(`Invalid SVG asset: ${name}`);
        if (asset.w * asset.h * opts.ratio ** 2 > 16777216) throw new Error(`Asset ${name} exceeds 16 megapixels`);
        if (/<script|<foreignObject|\bon\w+\s*=|@import|(?:href|src)\s*=\s*["'](?!#)|url\(\s*(?!["']?#)/i.test(asset.svg)) throw new Error(`Asset ${name} must be self-contained SVG without scripts or external references`);
        const image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(asset.svg);
        await image.decode();
        const canvas = document.createElement('canvas');
        canvas.width = asset.w * opts.ratio; canvas.height = asset.h * opts.ratio;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('2D canvas is unavailable');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        asset.data_url = canvas.toDataURL('image/png');
        asset.pixelWidth = canvas.width; asset.pixelHeight = canvas.height;
        delete asset.svg;
      }
      const url = URL.createObjectURL(new Blob([JSON.stringify(assets)], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = opts.outputName; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return { status: 'download-requested', filename: opts.outputName, assets: Object.keys(assets) };
    }, options);
  } finally {
    await page.locator('#styk-tool-assets').evaluate(input => input.remove());
  }
}
async function recoveryProject(page, options) {
  return await page.evaluate(async opts => {
    const databases = await indexedDB.databases();
    if (!databases.some(db => db.name === 'stykanimate-recovery')) throw new Error('No StykAnimate recovery database exists');
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('stykanimate-recovery');
      r.onupgradeneeded = () => { r.transaction.abort(); reject(new Error('Recovery schema changed')); };
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    let docs;
    try {
      docs = await new Promise((resolve, reject) => {
        const r = db.transaction('documents', 'readonly').objectStore('documents').getAll();
        r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      });
    } finally { db.close(); }
    const matches = docs.filter(d => d.name === opts.projectName);
    if (matches.length !== 1) throw new Error('Current recovery record is missing or ambiguous');
    const d = matches[0];
    if (!(d.data instanceof ArrayBuffer) || new TextDecoder().decode(d.data.slice(0, 4)) !== 'STYK') throw new Error('Unexpected recovery format');
    const result = { name: d.name, bytes: d.data.byteLength, savedAt: d.savedAt, token: d.token };
    if (opts.download) {
      if (!Number.isFinite(d.savedAt) || d.savedAt < opts.minimumSavedAt) throw new Error('Recovery does not include the latest edit');
      const url = URL.createObjectURL(new Blob([d.data], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.download = opts.outputName; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      result.status = 'download-requested';
    }
    return result;
  }, options);
}
async function verifyVideo(page, options) {
  await page.evaluate(() => {
    if (document.getElementById('styk-tool-video')) throw new Error('Another video verification is active');
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'styk-tool-video'; input.hidden = true; document.body.appendChild(input);
  });
  try {
    await page.locator('#styk-tool-video').setInputFiles(options.file);
    return await page.evaluate(async opts => {
      const video = document.createElement('video');
      video.muted = true; video.preload = 'auto';
      video.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(video);
      const url = URL.createObjectURL(document.getElementById('styk-tool-video').files[0]);
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => { clear(); reject(new Error('Video load timed out')); }, 15000);
          const clear = () => { clearTimeout(timer); video.onloadeddata = null; video.onerror = null; };
          video.onloadeddata = () => { clear(); resolve(); };
          video.onerror = () => { clear(); reject(new Error('Video decoding failed')); };
          video.src = url;
        });
        if (Math.abs(video.duration - opts.seconds) > .05 || video.videoWidth !== opts.width || video.videoHeight !== opts.height) throw new Error('Decoded video dimensions or duration do not match');
        if (typeof video.requestVideoFrameCallback !== 'function') throw new Error('Presented-frame verification requires requestVideoFrameCallback; seeked alone can return stale pixels');
        if (opts.times.some(t => t < 0 || t >= video.duration)) throw new Error('Sample times must be within the video');
        const canvas = document.createElement('canvas');
        canvas.width = 1280; canvas.height = Math.ceil(opts.times.length / 4) * 208;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('2D canvas is unavailable');
        context.fillStyle = '#142b29'; context.fillRect(0, 0, canvas.width, canvas.height);
        const samples = [];
        for (let i = 0; i < opts.times.length; i++) {
          const time = opts.times[i];
          const metadata = await new Promise((resolve, reject) => {
            let handle;
            const timer = setTimeout(() => { video.cancelVideoFrameCallback(handle); reject(new Error(`Frame ${time} was not presented`)); }, 10000);
            const receive = (_, meta) => {
              if (Math.abs(meta.mediaTime - time) <= 1 / opts.fps + .001) { clearTimeout(timer); resolve(meta); }
              else handle = video.requestVideoFrameCallback(receive);
            };
            handle = video.requestVideoFrameCallback(receive);
            video.currentTime = time;
          });
          samples.push(metadata.mediaTime);
          if (opts.contactSheet) {
            const x = i % 4 * 320, y = Math.floor(i / 4) * 208;
            context.drawImage(video, x, y, 320, 180);
            context.fillStyle = '#f6edd6'; context.font = '13px sans-serif';
            context.fillText(`${metadata.mediaTime.toFixed(2)} seconds`, x + 9, y + 198);
          }
        }
        if (opts.contactSheet) {
          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
          if (!blob) throw new Error('Contact sheet PNG encoding failed');
          const imageUrl = URL.createObjectURL(blob), a = document.createElement('a');
          a.href = imageUrl; a.download = opts.contactSheet; a.click();
          setTimeout(() => URL.revokeObjectURL(imageUrl), 60000);
        }
        return { seconds: video.duration, width: video.videoWidth, height: video.videoHeight, presentedSamples: samples, contactSheet: opts.contactSheet ?? null };
      } finally { video.removeAttribute('src'); video.load(); video.remove(); URL.revokeObjectURL(url); }
    }, options);
  } finally { await page.locator('#styk-tool-video').evaluate(input => input.remove()); }
}

const operations = {
  'inspect-scene': inspectScene, 'import-audio': importAudio,
  'import-project': importProject, seek: seekFrame, 'picker-mode': pickerMode,
  'save-project': saveProject, 'export-mp4': exportMp4, 'rasterize-assets': rasterizeAssets,
  'recovery-project': recoveryProject, 'verify-video': verifyVideo
};
function makeCall(operation, supplied) {
  const fn = operations[operation], o = { ...supplied };
  if (!fn) throw new Error(`Unknown browser operation: ${operation}`);
  const required = (condition, message) => { if (!condition) throw new Error(message); };
  const text = key => required(typeof o[key] === 'string' && o[key].trim().length > 0, `${key} is required`);
  const number = (key, integral = false) => required(Number.isFinite(o[key]) && o[key] > 0 && (!integral || Number.isSafeInteger(o[key])), `${key} must be positive${integral ? ' integer' : ''}`);
  const filename = key => {
    text(key);
    required(!/[\\/:*?"<>|\x00-\x1f]/.test(o[key]) && !/[. ]$/.test(o[key]) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(o[key]), `${key} must be a portable filename, not a path`);
  };
  text('pageId');
  if (['import-project', 'import-audio', 'rasterize-assets', 'verify-video'].includes(operation)) {
    text('file'); required(path.isAbsolute(o.file), 'file must be an absolute path on this machine');
  }
  if (['import-project', 'import-audio', 'export-mp4', 'recovery-project'].includes(operation)) text('projectName');
  if (operation === 'import-audio') {
    filename('clipName');
    required(path.basename(o.file) === o.clipName, 'clipName must match the audio filename');
  }
  if (operation === 'import-project') {
    required(o.replaceCurrent === true, 'Set replaceCurrent:true only after preserving existing work');
    required(o.projectName !== 'Untitled animation', 'Import needs a distinct project name');
    number('expectedKeys', true);
  } else if (operation === 'seek') number('frame', true);
  else if (operation === 'picker-mode') required(typeof o.enabled === 'boolean', 'enabled must be boolean');
  else if (operation === 'export-mp4') {
    filename('name'); required(!o.name.toLowerCase().endsWith('.mp4'), 'Export name must omit .mp4');
    number('frames', true);
    o.size ??= '1080p · 1920 × 1080';
    required(['1080p · 1920 × 1080', '720p · 1280 × 720', 'Original · 960 × 540'].includes(o.size), 'Unsupported export size label');
  } else if (operation === 'rasterize-assets') {
    o.ratio ??= 2; o.outputName ??= 'assets-rendered.json';
    number('ratio', true); required(o.ratio <= 4, 'Raster ratio cannot exceed 4'); filename('outputName');
  } else if (operation === 'recovery-project') {
    o.download ??= false; required(typeof o.download === 'boolean', 'download must be boolean');
    if (o.download) { number('minimumSavedAt', true); filename('outputName'); required(o.outputName.endsWith('.styk'), 'Recovery output must end in .styk'); }
  } else if (operation === 'verify-video') {
    for (const key of ['width', 'height', 'fps']) number(key, true);
    number('seconds');
    required(Array.isArray(o.times) && o.times.length > 0 && o.times.length <= 24 && o.times.every(t => Number.isFinite(t) && t >= 1 / o.fps && t < o.seconds), 'Provide 1..24 sample times from frame 2 up to (but not including) the duration');
    required(new Set(o.times.map(t => Math.floor(t * o.fps))).size === o.times.length, 'Sample times must refer to distinct frames');
    if (o.contactSheet !== undefined) filename('contactSheet');
  }
  const pageId = o.pageId;
  delete o.pageId;
  return { pageId, code: `return await (${fn.toString()})(page, ${JSON.stringify(o)});`, timeoutMs: 1000 };
}
module.exports = { makeCall, operations: Object.keys(operations) };
