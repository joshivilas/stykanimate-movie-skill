'use strict';

const zlib = require('node:zlib');
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function inspectMp4(data) {
  requireValue(Buffer.isBuffer(data), 'MP4 input must be a Buffer');
  const tracks = [], media = [];
  let movieSeconds, hasFileType = false;
  function boxes(start, end, visit) {
    let offset = start;
    while (offset < end) {
      requireValue(offset + 8 <= end, 'Truncated MP4 box header');
      let length = data.readUInt32BE(offset), header = 8;
      const kind = data.toString('ascii', offset + 4, offset + 8);
      if (length === 1) {
        requireValue(offset + 16 <= end, 'Truncated extended MP4 box');
        length = Number(data.readBigUInt64BE(offset + 8)); header = 16;
      }
      if (length === 0) length = end - offset;
      requireValue(Number.isSafeInteger(length) && length >= header && offset + length <= end, `Invalid or incomplete MP4 ${kind} box`);
      visit(kind, offset + header, offset + length);
      offset += length;
    }
  }
  function timing(s, e) {
    requireValue(e - s >= 4 && [0, 1].includes(data[s]), 'Unsupported MP4 timing version');
    const offset = s + (data[s] === 1 ? 20 : 12);
    requireValue(offset + (data[s] === 1 ? 12 : 8) <= e, 'Truncated MP4 timing');
    const scale = data.readUInt32BE(offset);
    const duration = data[s] === 1 ? Number(data.readBigUInt64BE(offset + 4)) : data.readUInt32BE(offset + 4);
    requireValue(scale > 0 && Number.isSafeInteger(duration), 'Invalid MP4 timescale/duration');
    return { scale, seconds: duration / scale };
  }
  function trackBoxes(start, end, track) {
    boxes(start, end, (kind, s, e) => {
      if (['mdia', 'minf', 'stbl'].includes(kind)) trackBoxes(s, e, track);
      else if (kind === 'hdlr') {
        requireValue(e - s >= 12, 'Truncated MP4 handler');
        track.handler = data.toString('ascii', s + 8, s + 12);
      } else if (kind === 'tkhd') {
        requireValue(e - s >= 8, 'Truncated MP4 track header');
        track.width = data.readUInt32BE(e - 8) / 65536;
        track.height = data.readUInt32BE(e - 4) / 65536;
      } else if (kind === 'mdhd') Object.assign(track, timing(s, e));
      else if (kind === 'stsz') {
        requireValue(e - s >= 12, 'Truncated MP4 sample-size table');
        const size = data.readUInt32BE(s + 4), count = data.readUInt32BE(s + 8);
        requireValue(size !== 0 || s + 12 + count * 4 <= e, 'Truncated MP4 sample sizes');
        track.frames = count;
        track.sampleBytes = size * count;
        if (!size) for (let i = 0; i < count; i++) track.sampleBytes += data.readUInt32BE(s + 12 + i * 4);
      } else if (kind === 'stts') {
        requireValue(e - s >= 8, 'Truncated MP4 time-to-sample table');
        const count = data.readUInt32BE(s + 4);
        requireValue(s + 8 + count * 8 <= e, 'Truncated MP4 sample timing');
        track.timedFrames = 0; track.ticks = 0; track.deltas = new Set();
        for (let i = 0; i < count; i++) {
          const n = data.readUInt32BE(s + 8 + i * 8), delta = data.readUInt32BE(s + 12 + i * 8);
          requireValue(n > 0 && delta > 0, 'Invalid MP4 sample timing entry');
          track.timedFrames += n; track.ticks += n * delta; track.deltas.add(delta);
        }
      }
    });
  }
  boxes(0, data.length, (kind, s, e) => {
    if (kind === 'ftyp') hasFileType = true;
    else if (kind === 'mdat') media.push(e - s);
    else if (kind === 'moov') boxes(s, e, (inner, a, b) => {
      if (inner === 'mvhd') movieSeconds = timing(a, b).seconds;
      else if (inner === 'trak') {
        const track = {};
        trackBoxes(a, b, track); tracks.push(track);
      }
    });
  });
  const video = tracks.filter(t => t.handler === 'vide');
  requireValue(hasFileType && media.length > 0 && Number.isFinite(movieSeconds), 'Missing MP4 container metadata/media');
  requireValue(video.length === 1, 'Expected exactly one video track');
  const v = video[0];
  requireValue(v.frames > 0 && v.width > 0 && v.height > 0 && v.seconds > 0, 'Incomplete video track; fragmented MP4 is not supported');
  requireValue(v.timedFrames === v.frames && v.ticks > 0 && v.scale > 0, 'Inconsistent video sample tables');
  requireValue(v.sampleBytes > 0 && v.sampleBytes <= media.reduce((a, b) => a + b, 0), 'Video samples exceed available media data');
  return {
    width: v.width, height: v.height, frames: v.frames, seconds: v.ticks / v.scale,
    fps: v.frames * v.scale / v.ticks, constantFrameRate: v.deltas.size === 1,
    movieSeconds, audioTracks: tracks.filter(t => t.handler === 'soun').length, bytes: data.length
  };
}
function inspectNative(data) {
  requireValue(Buffer.isBuffer(data) && data.length >= 60, 'Truncated native project');
  requireValue(data.toString('ascii', 0, 4) === 'STYK', 'Not a native STYK project');
  requireValue(data.subarray(4, 8).equals(Buffer.from([2, 2, 0, 0])), 'Unsupported STYK header revision; do not guess its offsets');
  requireValue(typeof zlib.zstdDecompressSync === 'function', 'Native inspection requires Node.js 24 or a runtime with built-in zstd');
  const plain = Number(data.readBigUInt64LE(8)), compressed = Number(data.readBigUInt64LE(16));
  requireValue(Number.isSafeInteger(plain) && plain > 0 && plain <= 128 * 1024 * 1024, 'Native JSON exceeds the 128 MiB inspection limit');
  requireValue(Number.isSafeInteger(compressed) && compressed > 0 && 60 + compressed <= data.length, 'Truncated native JSON block');
  requireValue(data.subarray(60, 64).equals(Buffer.from([0x28, 0xb5, 0x2f, 0xfd])), 'Unexpected native compression header');
  const decoded = zlib.zstdDecompressSync(data.subarray(60, 60 + compressed), { maxOutputLength: 128 * 1024 * 1024 });
  requireValue(decoded.length === plain, 'Native JSON length mismatch');
  const project = JSON.parse(decoded.toString('utf8'));
  requireValue(project._styk?.format === 'StykAnimate', 'Unexpected native document format');
  const frames = project._styk?.layerSheet?.duration;
  requireValue(Number.isSafeInteger(frames) && frames > 0 && Number.isFinite(project.fps) && project.fps > 0, 'Unsupported native timeline representation');
  requireValue(Array.isArray(project.figure_types), 'Missing native figure types');
  return {
    name: project._styk.name, width: project.canvas_width, height: project.canvas_height,
    fps: project.fps, frames, seconds: frames / project.fps,
    typeNames: project.figure_types.map(t => t.name), bytes: data.length
  };
}
function compare(actual, expected, fields) {
  requireValue(expected && typeof expected === 'object', 'Expected media specification is required');
  for (const key of fields) {
    requireValue(Number.isFinite(expected[key]) && expected[key] > 0, `Expected ${key} must be positive`);
    const tolerance = key === 'seconds' || key === 'fps' ? .001 : 0;
    requireValue(Number.isFinite(actual[key]) && Math.abs(actual[key] - expected[key]) <= tolerance, `${key}: expected ${expected[key]}, got ${actual[key]}`);
  }
}
function verify(videoData, nativeData, expected) {
  requireValue(expected && typeof expected === 'object' && expected.video && expected.project, 'Verification requires video and project specifications');
  const video = inspectMp4(videoData), project = inspectNative(nativeData);
  compare(video, expected.video, ['width', 'height', 'fps', 'frames', 'seconds']);
  if (expected.video.audioTracks !== undefined) {
    requireValue(Number.isSafeInteger(expected.video.audioTracks) && expected.video.audioTracks >= 0, 'Expected audioTracks must be a nonnegative integer');
    requireValue(video.audioTracks === expected.video.audioTracks, `audioTracks: expected ${expected.video.audioTracks}, got ${video.audioTracks}`);
  }
  compare(project, expected.project, ['width', 'height', 'fps', 'frames']);
  requireValue(video.constantFrameRate, 'Video is not constant frame rate');
  requireValue(typeof expected.project.name === 'string' && project.name === expected.project.name, 'Native project name mismatch');
  requireValue(Array.isArray(expected.project.typeNames) && expected.project.typeNames.every(n => typeof n === 'string'), 'Expected project.typeNames must be an array of names');
  for (const name of expected.project.typeNames) requireValue(project.typeNames.includes(name), `Missing native figure type: ${name}`);
  requireValue(video.frames === project.frames && Math.abs(video.seconds - project.seconds) <= .001, 'Video/project duration mismatch');
  return { video, project };
}
module.exports = { inspectMp4, inspectNative, verify };
