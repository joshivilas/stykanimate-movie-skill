'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const A = require('./animation.cjs');

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function doctor() {
  const checks = {
    node24OrNewer: Number(process.versions.node.split('.')[0]) >= 24,
    nativeZstd: typeof zlib.zstdDecompressSync === 'function',
    supportedOS: ['win32', 'linux', 'darwin'].includes(process.platform)
  };
  requireValue(Object.values(checks).every(Boolean), `Unsupported environment: ${JSON.stringify(checks)}. Install Node.js 24 or newer on Windows, Linux or macOS.`);
  return {
    ready: true, node: process.versions.node, platform: process.platform, arch: process.arch, checks,
    home: os.homedir(), temp: os.tmpdir(), cwd: process.cwd(),
    browser: 'Not checked: provide a browser automation tool with a Playwright page and local file access, or use the manual editor recipes.'
  };
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return { file: path.resolve(file) };
}
function storyboard(spec) {
  requireValue(spec && typeof spec.name === 'string' && spec.name.trim(), 'Storyboard needs a name');
  const { fps = 24, width = 960, height = 540, beats } = spec;
  for (const [key, value] of Object.entries({ fps, width, height })) {
    requireValue(Number.isSafeInteger(value) && value > 0, `${key} must be a positive integer`);
  }
  requireValue(Array.isArray(beats) && beats.length > 0, 'Storyboard needs beats');
  let cursor = 0;
  const shots = beats.map((beat, index) => {
    requireValue(beat && typeof beat.action === 'string' && beat.action.trim(), `Beat ${index + 1} needs an action`);
    const frames = beat.seconds * fps;
    requireValue(Number.isFinite(beat.seconds) && beat.seconds > 0 && Math.abs(frames - Math.round(frames)) < 1e-7, `Beat ${index + 1} must occupy a whole positive number of frames`);
    const count = Math.round(frames), start = cursor;
    cursor += count;
    requireValue(Number.isSafeInteger(cursor), 'Storyboard has too many frames');
    return {
      ...beat, seconds: count / fps, startSeconds: start / fps, endSeconds: cursor / fps,
      firstFrame: start + 1, lastFrame: cursor, frames: count
    };
  });
  return { name: spec.name, width, height, fps, frames: cursor, seconds: cursor / fps, beats: shots };
}
function expectations(movie, options = {}) {
  const info = A.validateMovie(movie);
  const { width = 1920, height = 1080, audioTracks = 0 } = options;
  requireValue(Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0, 'Export dimensions must be positive integers');
  requireValue(width * movie.canvas_height === height * movie.canvas_width, 'Export aspect ratio must match the scene');
  requireValue(Number.isSafeInteger(audioTracks) && audioTracks >= 0, 'audioTracks must be a nonnegative integer');
  requireValue(typeof movie._styk?.name === 'string' && movie._styk.name.trim(), 'Movie needs a project name');
  return {
    video: { width, height, fps: info.fps, frames: info.frames, seconds: info.seconds, audioTracks },
    project: {
      name: movie._styk.name, width: movie.canvas_width, height: movie.canvas_height,
      fps: info.fps, frames: info.frames, typeNames: movie.figure_types.map(t => t.name)
    }
  };
}
function synthesizeAudio(spec) {
  requireValue(spec && Number.isFinite(spec.seconds) && spec.seconds > 0 && spec.seconds <= 600, 'Audio seconds must be in (0, 600]');
  const rate = spec.sampleRate ?? 48000;
  requireValue([24000, 44100, 48000].includes(rate), 'sampleRate must be 24000, 44100 or 48000');
  requireValue(Array.isArray(spec.cues) && spec.cues.length <= 1000, 'Audio needs at most 1000 cues');
  const count = Math.round(spec.seconds * rate);
  requireValue(count > 0, 'Audio must contain at least one sample');
  const mix = new Float64Array(count);
  for (const [index, cue] of spec.cues.entries()) {
    requireValue(cue && ['tone', 'noise'].includes(cue.kind), `Cue ${index + 1}: kind must be tone or noise`);
    const { start, seconds, gain = .15, frequency = 440, fade = .01 } = cue;
    requireValue(Number.isFinite(start) && start >= 0 && Number.isFinite(seconds) && seconds > 0 && start + seconds <= spec.seconds + 1e-9, `Cue ${index + 1} is outside the soundtrack`);
    requireValue(Number.isFinite(gain) && gain >= 0 && gain <= 1, 'Cue gain must be 0..1');
    requireValue(Number.isFinite(fade) && fade > 0 && fade <= seconds / 2, 'Cue fade must be positive and no longer than half the cue');
    if (cue.kind === 'tone') requireValue(Number.isFinite(frequency) && frequency > 0 && frequency < rate / 2, 'Tone frequency must be below Nyquist');
    const begin = Math.round(start * rate), samples = Math.round(seconds * rate);
    requireValue(samples > 0 && begin + samples <= count, 'Rounded cue exceeds soundtrack sample bounds');
    let seed = index + 1;
    for (let i = 0; i < samples; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const signal = cue.kind === 'tone' ? Math.sin(2 * Math.PI * frequency * i / rate) : seed / 0x100000000 * 2 - 1;
      const envelope = Math.min(1, i / (fade * rate), (samples - 1 - i) / (fade * rate));
      mix[begin + i] += signal * gain * envelope;
    }
  }
  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  requireValue(peak <= 1, `Audio clips (peak ${peak.toFixed(3)}); reduce cue gains`);
  const data = Buffer.alloc(44 + count * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8);
  data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
  data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++) data.writeInt16LE(Math.round(mix[i] * 32767), 44 + i * 2);
  return data;
}
function inspectWav(data) {
  requireValue(Buffer.isBuffer(data) && data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WAVE', 'Expected RIFF/WAVE audio');
  requireValue(data.readUInt32LE(4) + 8 === data.length, 'WAV length mismatch');
  let format, payload, offset = 12;
  while (offset < data.length) {
    requireValue(offset + 8 <= data.length, 'Truncated WAV chunk');
    const kind = data.toString('ascii', offset, offset + 4), size = data.readUInt32LE(offset + 4), start = offset + 8;
    requireValue(start + size + (size % 2) <= data.length, 'Truncated WAV payload');
    if (kind === 'fmt ') {
      requireValue(!format && size >= 16, 'Invalid or duplicate WAV format');
      format = {
        codec: data.readUInt16LE(start), channels: data.readUInt16LE(start + 2),
        sampleRate: data.readUInt32LE(start + 4), byteRate: data.readUInt32LE(start + 8),
        blockAlign: data.readUInt16LE(start + 12), bits: data.readUInt16LE(start + 14)
      };
    } else if (kind === 'data') {
      requireValue(payload === undefined, 'Duplicate WAV data');
      payload = data.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  requireValue(format && payload && format.codec === 1 && format.bits === 16 && [1, 2].includes(format.channels), 'Only mono/stereo PCM16 WAV is supported');
  requireValue(format.sampleRate > 0 && format.blockAlign === format.channels * 2 && format.byteRate === format.sampleRate * format.blockAlign && payload.length > 0 && payload.length % format.blockAlign === 0, 'Invalid WAV sample metadata');
  let peak = 0;
  for (let i = 0; i < payload.length; i += 2) peak = Math.max(peak, Math.abs(payload.readInt16LE(i)) / 32768);
  const samples = payload.length / format.blockAlign;
  return { channels: format.channels, sampleRate: format.sampleRate, samples, seconds: samples / format.sampleRate, peak, bytes: data.length };
}

module.exports = { doctor, writeJson, storyboard, expectations, synthesizeAudio, inspectWav };
