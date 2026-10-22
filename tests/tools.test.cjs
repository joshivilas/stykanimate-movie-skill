'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const A = require('../scripts/animation.cjs');
const F = require('../scripts/formats.cjs');
const B = require('../scripts/browser.cjs');
const example = require('../examples/walk-and-wave.cjs');
const near = (a, b) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const length = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

test('two-bone IK preserves lengths, endpoints, bend side, and folded poses', () => {
  for (const side of [-1, 1]) {
    const ik = A.solveTwoBone([0, 0], [30, 20], 28, 26, side);
    near(length([0, 0], ik.joint), 28); near(length(ik.joint, ik.end), 26);
    assert.deepEqual(ik.end, [30, 20]);
    assert.equal(Math.sign(30 * ik.joint[1] - 20 * ik.joint[0]), side);
  }
  const folded = A.solveTwoBone([4, 5], [4, 5], 10, 10);
  near(length([4, 5], folded.joint), 10); near(length(folded.joint, folded.end), 10);
  assert.throws(() => A.solveTwoBone([0, 0], [55, 0], 28, 26), /Unreachable/);
  assert.throws(() => A.solveTwoBone([0, 0], [0, 0], 28, 26), /Unreachable/);
  assert.throws(() => A.solveTwoBone([0, 0], [2, 0], 0, 2), /positive/);
});

test('walk stance feet stay fixed in world space in both directions', () => {
  const rig = A.createRig({ id: 1, name: 'Walker' });
  let checked = 0;
  for (const toX of [420, 180]) {
    let previous;
    for (let i = 0; i <= 144; i++) {
      const current = A.walkPose(rig, { fromX: 300, toX, start: 0, end: 6, time: i / 24, ground: 440 });
      A.solveActor(rig, current.pose);
      for (let foot = 0; foot < 2; foot++) {
        const c = current.contacts[foot], p = previous?.contacts[foot];
        if (c.planted && p?.planted && c.cycle === p.cycle) {
          assert.deepEqual(current.pose.feet[foot], previous.pose.feet[foot]); checked++;
        }
      }
      previous = current;
    }
  }
  assert(checked > 150);
});

test('actor solves carry contacts without mutating the original pose', () => {
  const rig = A.createRig({ id: 1, name: 'Actor' });
  const standing = A.standing(rig, 200, 440), original = structuredClone(standing);
  const carried = A.carrying(rig, standing);
  const actor = A.solveActor(rig, carried);
  assert.deepEqual(standing, original);
  assert.deepEqual(actor.hands, carried.hands);
  const center = A.heldCenter(actor);
  near(center[0], 228);
  assert.equal(actor.object.angles.length, rig.type.segment_count);
  assert.throws(() => A.solveActor(rig, { ...carried, hands: [[999, 999], carried.hands[1]] }), /Unreachable/);
});

test('tracks validate chronology, return independent values, and honor exact key times', () => {
  const t = A.track([[0, [0]], [1, [10]], [2, [20]]], { easing: 'constant' });
  assert.deepEqual(t(.5), [0]); assert.deepEqual(t(1), [10]); assert.deepEqual(t(3), [20]);
  const v = t(0); v[0] = 99; assert.deepEqual(t(0), [0]);
  assert.throws(() => A.track([[0, [1]], [0, [2]]]), /strictly increase/);
  assert.throws(() => A.track([[0, [1]], [1, [2, 3]]]), /equal-length/);
  const rig = A.createRig({ id: 1, name: 'Actor' });
  assert.throws(() => A.blendPose(A.standing(rig, 100, 440), A.standing(rig, 100, 440, -1), .5), /turning pose/);
});

test('object opacity uses the actual StykAnimate field28 byte', () => {
  const props = { id: 1, typeId: 1, x: 0, y: 0, angles: [0] };
  assert.equal(A.object({ ...props, opacity: 1 }).field28, 0);
  assert.equal(A.object({ ...props, opacity: 0 }).field28, 255);
  assert.equal(A.object({ ...props, opacity: .5 }).field28, 128);
  assert.throws(() => A.object({ ...props, opacity: 2 }), /Opacity/);
  assert.throws(() => A.object({ ...props, angles: [NaN] }), /finite/);
});

test('image helper verifies PNG dimensions and keeps scene-space sizing', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6s8sAAAAASUVORK5CYII=', 'base64');
  const asset = { w: 20, h: 20, pixelWidth: 1, pixelHeight: 1, data_url: `data:image/png;base64,${png.toString('base64')}` };
  const type = A.imageType(1, 'Image', asset);
  assert.equal(type.segments[0].length, 10); assert.equal(type.image_assets[0].anchor_length, .5);
  assert.throws(() => A.imageType(1, 'Image', { ...asset, pixelWidth: 2 }), /dimensions/);
});

test('demo is a complete ten-second dense movie with persistent actors', () => {
  const movie = example();
  assert.deepEqual(A.validateMovie(movie), { frames: 240, fps: 24, seconds: 10, types: 3, objects: 3 });
  assert.equal(movie.keyframes.at(-1)._styk.easing.interpolation, 'constant');
  assert(movie.keyframes.every(f => f.duration_raw === 1));
  const bad = structuredClone(movie);
  bad.keyframes[1].objects[2].angles[0] = NaN;
  assert.throws(() => A.validateMovie(bad), /angles/);
  const duplicate = structuredClone(movie);
  duplicate.keyframes[0].objects[1].unique_id = 1;
  assert.throws(() => A.validateMovie(duplicate), /Duplicate/);
  assert.throws(() => A.createMovie({ name: 'Bad', seconds: .01, types: [], sample: () => [] }), /whole number/);
});

test('movie writer refuses accidental replacement and CLI returns nonzero on failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'styk-tools-test-'));
  const file = path.join(dir, 'movie.json');
  try {
    A.writeMovie(file, example());
    assert.throws(() => A.writeMovie(file, example()), /EEXIST/);
    const cli = path.join(__dirname, '..', 'scripts', 'styk-tools.cjs');
    assert.equal(spawnSync(process.execPath, [cli, 'validate', file], { encoding: 'utf8' }).status, 0);
    const bad = spawnSync(process.execPath, [cli, 'unknown'], { encoding: 'utf8' });
    assert.equal(bad.status, 1); assert.match(bad.stderr, /Unknown command/);
  } finally {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    fs.rmdirSync(dir);
  }
});

function box(kind, ...parts) {
  const payload = Buffer.concat(parts), header = Buffer.alloc(8);
  header.writeUInt32BE(payload.length + 8); header.write(kind, 4);
  return Buffer.concat([header, payload]);
}
function timing(seconds, scale = 24) {
  const data = Buffer.alloc(24); data.writeUInt32BE(scale, 12); data.writeUInt32BE(seconds * scale, 16);
  return data;
}
function fakeMp4({ audio = true, frames = 240, seconds = 10 } = {}) {
  const makeTrack = (handler, count, size) => {
    const tkhd = Buffer.alloc(84), hdlr = Buffer.alloc(16), stsz = Buffer.alloc(12), stts = Buffer.alloc(16);
    if (handler === 'vide') { tkhd.writeUInt32BE(1920 * 65536, 76); tkhd.writeUInt32BE(1080 * 65536, 80); }
    hdlr.write(handler, 8); stsz.writeUInt32BE(size, 4); stsz.writeUInt32BE(count, 8);
    stts.writeUInt32BE(1, 4); stts.writeUInt32BE(count, 8); stts.writeUInt32BE(1, 12);
    return box('trak', box('tkhd', tkhd), box('mdia', box('hdlr', hdlr), box('mdhd', timing(seconds, count / seconds)),
      box('minf', box('stbl', box('stsz', stsz), box('stts', stts)))));
  };
  return Buffer.concat([
    box('ftyp', Buffer.from('isom0000')), box('moov', box('mvhd', timing(seconds)), makeTrack('vide', frames, 1),
      ...(audio ? [makeTrack('soun', 480, 2)] : [])), box('mdat', Buffer.alloc(frames + (audio ? 960 : 0)))
  ]);
}
function fakeNative() {
  const data = Buffer.from(JSON.stringify({
    fps: 24, canvas_width: 960, canvas_height: 540, figure_types: [{ name: 'Example actor' }],
    _styk: { format: 'StykAnimate', name: 'Example', layerSheet: { duration: 240 } }
  }));
  const compressed = zlib.zstdCompressSync(data), header = Buffer.alloc(60);
  header.write('STYK'); Buffer.from([2, 2, 0, 0]).copy(header, 4);
  header.writeBigUInt64LE(BigInt(data.length), 8); header.writeBigUInt64LE(BigInt(compressed.length), 16);
  return Buffer.concat([header, compressed]);
}
test('MP4 parser isolates video from audio sample counts', () => {
  const parsed = F.inspectMp4(fakeMp4());
  assert.equal(parsed.frames, 240); assert.equal(parsed.fps, 24);
  assert.equal(parsed.width, 1920); assert.equal(parsed.height, 1080);
  assert.equal(parsed.audioTracks, 1); assert.equal(parsed.constantFrameRate, true);
  assert.throws(() => F.inspectMp4(fakeMp4().subarray(0, 40)), /incomplete/);
  assert.throws(() => F.inspectMp4(Buffer.from('garbage')), /Truncated/);
});
test('native inspector checks revision, lengths, compression, and exact output specifications', () => {
  const native = fakeNative(), video = fakeMp4();
  assert.equal(F.inspectNative(native).frames, 240);
  const bad = Buffer.from(native); bad[4] = 99;
  assert.throws(() => F.inspectNative(bad), /Unsupported STYK/);
  assert.throws(() => F.inspectNative(native.subarray(0, 63)), /Truncated/);
  const expected = {
    video: { width: 1920, height: 1080, frames: 240, fps: 24, seconds: 10 },
    project: { name: 'Example', width: 960, height: 540, fps: 24, frames: 240, typeNames: ['Example actor'] }
  };
  assert.equal(F.verify(video, native, expected).video.frames, 240);
  assert.equal(F.verify(video, native, { ...expected, video: { ...expected.video, audioTracks: 1 } }).video.audioTracks, 1);
  assert.throws(() => F.verify(video, native, { ...expected, video: { ...expected.video, audioTracks: 0 } }), /audioTracks/);
  assert.throws(() => F.verify(video, native, { ...expected, video: { ...expected.video, audioTracks: -1 } }), /nonnegative/);
  assert.throws(() => F.verify(video, native, { ...expected, video: { ...expected.video, frames: 239 } }), /expected 239/);
});

test('browser generators emit self-contained syntactically valid calls with safely quoted paths', () => {
  const file = path.resolve('film with spaces.json'), pageId = 'test-page';
  const fixtures = {
    'import-project': { file, projectName: "A child's movie", replaceCurrent: true, expectedKeys: 240 },
    seek: { frame: 49 }, 'picker-mode': { enabled: true }, 'save-project': {},
    'export-mp4': { projectName: 'Film', name: 'Film', frames: 240 },
    'rasterize-assets': { file }, 'recovery-project': { projectName: 'Film' },
    'verify-video': { file, width: 1920, height: 1080, seconds: 10, fps: 24, times: [2, 8] }
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  for (const [op, options] of Object.entries(fixtures)) {
    const result = B.makeCall(op, { pageId, ...options });
    assert.equal(result.pageId, pageId);
    assert.equal(result.timeoutMs, 1000);
    assert.doesNotThrow(() => new AsyncFunction('page', result.code));
    assert(!result.code.includes("require("));
  }
  assert.match(B.makeCall('verify-video', { pageId, ...fixtures['verify-video'] }).code, /requestVideoFrameCallback/);
});
test('browser tools require explicit replacement permission and validate parameters', () => {
  assert.throws(() => B.makeCall('import-project', { pageId: 'p', file: path.resolve('f.json'), projectName: 'F', expectedKeys: 1 }), /preserving/);
  assert.throws(() => B.makeCall('seek', { pageId: 'p', frame: 0 }), /positive/);
  assert.throws(() => B.makeCall('rasterize-assets', { pageId: 'p', file: path.resolve('f.json'), outputName: '..\\outside.json' }), /filename/);
  assert.throws(() => B.makeCall('recovery-project', { pageId: 'p', projectName: 'F', download: true, outputName: 'F.styk' }), /minimumSavedAt/);
  assert.throws(() => B.makeCall('missing', { pageId: 'p' }), /Unknown/);
});
