'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const P = require('../scripts/production.cjs');
const R = require('../scripts/release.cjs');
const B = require('../scripts/browser.cjs');
const buildExample = require('../examples/walk-and-wave.cjs');
const beats = require('../examples/storyboard.json');
const cues = require('../examples/soundtrack.json');
const cli = path.resolve(__dirname, '..', 'scripts', 'styk-tools.cjs');

function withTemp(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'styk release test '));
  try { return run(directory); }
  finally { fs.rmSync(directory, { recursive: true }); }
}
test('doctor reports runtime capabilities without claiming browser readiness', () => {
  const result = P.doctor();
  assert.equal(result.ready, true);
  assert.equal(result.platform, process.platform);
  assert(path.isAbsolute(result.home));
  assert.match(result.browser, /Not checked/);
});
test('storyboard produces contiguous exact frame ranges without mutating input', () => {
  const original = structuredClone(beats), result = P.storyboard(beats);
  assert.deepEqual(beats, original);
  assert.equal(result.frames, 240);
  assert.equal(result.seconds, 10);
  assert.equal(result.beats[0].firstFrame, 1);
  assert.equal(result.beats[0].lastFrame, 144);
  assert.equal(result.beats[1].firstFrame, 145);
  assert.equal(result.beats.at(-1).lastFrame, 240);
  assert.equal(result.beats.at(-1).endSeconds, 10);
  assert.equal(P.storyboard({ name: 'Fractional', fps: 25, beats: [{ action: 'Hold', seconds: .28 }] }).frames, 7);
  assert.throws(() => P.storyboard({ ...beats, beats: [{ action: 'Bad', seconds: .01 }] }), /whole positive/);
  assert.throws(() => P.storyboard({ ...beats, beats: [{ action: '', seconds: 1 }] }), /action/);
  assert.throws(() => P.storyboard({ ...beats, fps: 0 }), /positive/);
});
test('expectations encode exact scene/output constraints and required audio', () => {
  const movie = buildExample(), result = P.expectations(movie);
  assert.deepEqual(result.video, { width: 1920, height: 1080, frames: 240, fps: 24, seconds: 10, audioTracks: 0 });
  assert.equal(result.project.name, 'Walk and wave');
  assert.deepEqual(result.project.typeNames, ['Backdrop', 'Example actor', 'Ground']);
  assert.equal(P.expectations(movie, { audioTracks: 1 }).video.audioTracks, 1);
  assert.throws(() => P.expectations(movie, { width: 1080, height: 1920 }), /aspect ratio/);
  assert.throws(() => P.expectations(movie, { audioTracks: -1 }), /nonnegative/);
});
test('sound synthesis is deterministic PCM16 with exact duration and silent boundaries', () => {
  const data = P.synthesizeAudio(cues), info = P.inspectWav(data);
  assert.deepEqual(data, P.synthesizeAudio(cues));
  assert.equal(info.seconds, 10);
  assert.equal(info.samples, 480000);
  assert.equal(info.channels, 1);
  assert.equal(info.sampleRate, 48000);
  assert(info.peak > .05 && info.peak < .2);
  assert.equal(data.readInt16LE(44), 0);
  assert.equal(data.readInt16LE(data.length - 2), 0);
  const silent = P.inspectWav(P.synthesizeAudio({ seconds: .5, sampleRate: 24000, cues: [] }));
  assert.equal(silent.peak, 0);
  assert.equal(silent.samples, 12000);
});
test('audio rejects clipping, invalid cue bounds, frequencies and unsupported formats', () => {
  const cue = { kind: 'tone', start: 0, seconds: 1, gain: 1 };
  assert.throws(() => P.synthesizeAudio({ seconds: 1, cues: [cue, cue] }), /clips/);
  assert.throws(() => P.synthesizeAudio({ seconds: 1, cues: [{ ...cue, start: .5 }] }), /outside/);
  assert.throws(() => P.synthesizeAudio({ seconds: 1, cues: [{ ...cue, frequency: 24000 }] }), /Nyquist/);
  assert.throws(() => P.synthesizeAudio({ seconds: 1, cues: [{ ...cue, fade: 0 }] }), /fade/);
  assert.throws(() => P.synthesizeAudio({ seconds: 601, cues: [] }), /600/);
  assert.throws(() => P.inspectWav(Buffer.from('not audio')), /RIFF/);
  const good = P.synthesizeAudio({ seconds: 1, cues: [] });
  assert.throws(() => P.inspectWav(good.subarray(0, 50)), /length/);
  const bad = Buffer.from(good);
  bad.writeUInt16LE(3, 20);
  assert.throws(() => P.inspectWav(bad), /PCM16/);
});
test('production CLI writes new artifacts and refuses overwrite or invalid input', () => withTemp(dir => {
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const source = path.join(dir, 'beats.json'), plan = path.join(dir, 'plan.json');
  fs.writeFileSync(source, JSON.stringify(beats));
  assert.equal(run('storyboard', source, plan).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(plan)).frames, 240);
  assert.equal(run('storyboard', source, plan).status, 1);
  const movie = path.join(dir, 'movie.json'), options = path.join(dir, 'export.json'), expected = path.join(dir, 'expected.json');
  fs.writeFileSync(movie, JSON.stringify(buildExample()));
  fs.writeFileSync(options, JSON.stringify({ audioTracks: 1 }));
  assert.equal(run('expectations', movie, options, expected).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(expected)).video.audioTracks, 1);
  const audioSpec = path.join(dir, 'cues.json'), wav = path.join(dir, 'audio.wav');
  fs.writeFileSync(audioSpec, JSON.stringify({ seconds: .1, cues: [] }));
  assert.equal(run('audio', audioSpec, wav).status, 0);
  assert.equal(run('inspect-wav', wav).status, 0);
  assert.equal(run('audio', audioSpec, wav).status, 1);
  assert.equal(run('doctor', 'unexpected').status, 1);
}));
test('new browser calls are self-contained and audio parameters are guarded', () => {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const [op, options] of [
    ['inspect-scene', {}],
    ['import-audio', { projectName: 'Film', clipName: 'sound.wav', file: path.resolve('sound.wav') }]
  ]) {
    const call = B.makeCall(op, { pageId: 'current', ...options });
    assert.doesNotThrow(() => new AsyncFunction('page', call.code));
    assert(!call.code.includes('require('));
  }
  assert.throws(() => B.makeCall('import-audio', { pageId: 'p', projectName: 'F', file: path.resolve('a.wav'), clipName: 'b.wav' }), /match/);
  assert.throws(() => B.makeCall('import-audio', { pageId: 'p', projectName: 'F', file: 'relative.wav', clipName: 'relative.wav' }), /absolute/);
});
test('scene inspection works in a restricted browser-tool context without Node URL globals', async () => {
  const vm = require('node:vm');
  const call = B.makeCall('inspect-scene', { pageId: 'p' });
  const page = {
    evaluate: async () => 'https://app.stykanimate.com',
    title: async () => 'Film',
    url: () => 'https://app.stykanimate.com/',
    locator: () => ({
      boundingBox: async () => ({ x: 0, y: 0, width: 960, height: 540 }),
      evaluateAll: async () => []
    }),
    getByRole: () => ({ count: async () => 0 })
  };
  const run = () => vm.runInNewContext(`(async function(page) { ${call.code} })(page)`, { page });
  assert.equal((await run()).edited, false);
  page.evaluate = async () => 'https://other.example';
  await assert.rejects(run(), /Expected the StykAnimate/);
});
test('release checks skill metadata and includes toolkit only', () => {
  assert.equal(R.check().ready, true);
  const files = R.releaseFiles();
  assert(files.some(f => f.name === 'SKILL.md'));
  assert(files.some(f => f.name === '.github/workflows/ci.yml'));
  assert(files.some(f => f.name === 'scripts/production.cjs'));
  assert(!files.some(f => /\.(mp4|styk|wav)$/.test(f.name)));
  assert.equal(R.crc32(Buffer.from('123456789')), 0xcbf43926);
});
test('ZIP is deterministic with valid checksums, manifest and portable root', () => withTemp(dir => {
  const first = path.join(dir, 'first.zip'), second = path.join(dir, 'second.zip');
  const packed = R.pack(first);
  R.pack(second);
  const data = fs.readFileSync(first);
  assert.deepEqual(data, fs.readFileSync(second));
  assert.equal(packed.bytes, data.length);
  assert.match(packed.sha256, /^[0-9a-f]{64}$/);
  assert.throws(() => R.pack(first), /EEXIST/);
  let offset = 0;
  const entries = new Map();
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const size = data.readUInt32LE(offset + 18), nameLength = data.readUInt16LE(offset + 26);
    const name = data.toString('utf8', offset + 30, offset + 30 + nameLength);
    assert(name.startsWith('stykanimate-movie-skill/'));
    assert(!name.includes('\\') && !name.includes('..'));
    const contents = data.subarray(offset + 30 + nameLength, offset + 30 + nameLength + size);
    assert.equal(R.crc32(contents), data.readUInt32LE(offset + 14));
    entries.set(name.slice('stykanimate-movie-skill/'.length), contents);
    offset += 30 + nameLength + size;
  }
  assert.equal(data.readUInt32LE(offset), 0x02014b50);
  assert.equal(data.readUInt32LE(data.length - 22), 0x06054b50);
  assert.equal(data.readUInt32LE(data.length - 6), offset);
  assert.equal(data.readUInt16LE(data.length - 12), entries.size);
  const manifest = JSON.parse(entries.get('MANIFEST.json'));
  assert.equal(manifest.files.length, entries.size - 1);
  const crypto = require('node:crypto');
  for (const file of manifest.files) {
    const contents = entries.get(file.path);
    assert.equal(contents.length, file.bytes);
    assert.equal(crypto.createHash('sha256').update(contents).digest('hex'), file.sha256);
  }
}));
test('installer copies an independent skill, handles spaces, and refuses replacement', () => withTemp(dir => {
  const destination = path.join(dir, 'project with spaces', '.github', 'skills');
  const result = R.install(destination);
  assert(fs.existsSync(path.join(result.installed, 'SKILL.md')));
  assert.throws(() => R.install(destination), /already exists/);
  const installedCLI = path.join(result.installed, 'scripts', 'styk-tools.cjs');
  const check = spawnSync(process.execPath, [installedCLI, 'doctor'], { cwd: dir, encoding: 'utf8' });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).ready, true);
  assert.throws(() => R.install(path.resolve(__dirname, '..', 'nested')), /outside/);
}));
test('quickstart prepares a validated silent demo with exact expectations and no overwrite', () => withTemp(dir => {
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { cwd: dir, encoding: 'utf8' });
  const result = run('quickstart', 'my demo');
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  const movie = JSON.parse(fs.readFileSync(output.movie));
  const expected = JSON.parse(fs.readFileSync(output.expectations));
  assert.deepEqual(expected, P.expectations(movie));
  assert.equal(output.frames, 240);
  assert.equal(output.seconds, 10);
  assert.equal(expected.video.audioTracks, 0);
  assert.match(output.next, /no browser or video export was run/);
  const original = fs.readFileSync(output.movie);
  assert.equal(run('quickstart', 'my demo').status, 1);
  assert.deepEqual(fs.readFileSync(output.movie), original);
  assert.deepEqual(fs.readdirSync(dir), ['my demo']);
  assert.equal(run('quickstart').status, 0);
  assert(fs.existsSync(path.join(dir, 'stykanimate-demo', 'movie.json')));
  const file = path.join(dir, 'existing file');
  fs.writeFileSync(file, 'keep');
  assert.equal(run('quickstart', file).status, 1);
  assert.equal(fs.readFileSync(file, 'utf8'), 'keep');
  assert.equal(run('quickstart', 'missing parent/child').status, 1);
  for (const command of ['quickstart', 'setup']) {
    assert.equal(run(command, '').status, 1);
    assert.equal(run(command, 'one', 'two').status, 1);
  }
}));
test('setup uses the safe installer and installed quickstart is self-contained', () => withTemp(dir => {
  const destination = path.join(dir, 'my skills');
  const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
  const result = run('setup', destination);
  assert.equal(result.status, 0, result.stderr);
  const installed = JSON.parse(result.stdout).installed;
  assert(fs.existsSync(path.join(installed, 'references', 'workflow.md')));
  assert.equal(run('setup', destination).status, 1);
  const demo = spawnSync(process.execPath, [path.join(installed, 'scripts', 'styk-tools.cjs'), 'quickstart'], { cwd: dir, encoding: 'utf8' });
  assert.equal(demo.status, 0, demo.stderr);
  assert.equal(JSON.parse(demo.stdout).frames, 240);
}));
test('setup defaults to the current user Copilot skills directory', t => withTemp(dir => {
  t.mock.method(os, 'homedir', () => dir);
  const result = require('../scripts/styk-tools.cjs').main(['setup']);
  assert.equal(result.installed, path.join(dir, '.copilot', 'skills', 'stykanimate-movie-skill'));
  assert.throws(() => require('../scripts/styk-tools.cjs').main(['setup']), /already exists/);
}));
test('quickstart cleans staging and reports failures without creating a partial demo', t => withTemp(dir => {
  t.mock.method(P, 'writeJson', () => { throw new Error('test write failure'); });
  assert.throws(() => require('../scripts/styk-tools.cjs').main(['quickstart', path.join(dir, 'demo')]), /test write failure/);
  assert.deepEqual(fs.readdirSync(dir), []);
}));
