'use strict';

const fs = require('node:fs');

function check(condition, message) {
  if (!condition) throw new Error(message);
}
function finite(value, name) {
  check(Number.isFinite(value), `${name} must be a finite number`);
  return value;
}
function positive(value, name) {
  finite(value, name);
  check(value > 0, `${name} must be positive`);
  return value;
}
function integer(value, name) {
  positive(value, name);
  check(Number.isSafeInteger(value), `${name} must be a positive safe integer`);
  return value;
}
function xy(value, name) {
  check(Array.isArray(value) && value.length === 2 && value.every(Number.isFinite), `${name} must be [x, y]`);
  return value;
}
const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { n = clamp(finite(n, 'progress')); return n * n * (3 - 2 * n); };
const mix = (a, b, u) => a + (b - a) * u;
const mixPoint = (a, b, u) => [mix(a[0], b[0], u), mix(a[1], b[1], u)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const vector = (angle, length) => [Math.cos(angle) * length, Math.sin(angle) * length];
const radians = degrees => finite(degrees, 'degrees') * Math.PI / 180;
const angleBetween = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);

function color(hex) {
  check(typeof hex === 'string' && /^#[0-9a-f]{6}$/i.test(hex), 'Color must be #RRGGBB');
  return hex.slice(1).match(/../g).map(c => parseInt(c, 16));
}
function segment(id, parent, length, width, hex, name, kind = 'line') {
  integer(id, 'segment id');
  check(Number.isSafeInteger(parent) && parent >= 0, 'parent must be a nonnegative integer');
  positive(length, 'segment length');
  finite(width, 'segment width');
  check(width >= 0, 'segment width cannot be negative');
  check(['line', 'circleFill'].includes(kind), 'Unsupported segment kind');
  return {
    segment_id: id, parent_id: parent, length, angle_rad: 0, thickness: width,
    bend_rad: 0, primitive_code: kind === 'line' ? 0 : 3, aux_code: 0,
    flags: kind === 'line' ? 0 : 3, segment_type: kind === 'line' ? 'line' : 'circle',
    segment_kind: kind, color_rgb: color(hex), transparency: 0, visible: true, z_order: id, name
  };
}
function figureType(id, name, segments) {
  integer(id, 'figure type id');
  check(typeof name === 'string' && name.trim(), 'Figure type needs a name');
  check(Array.isArray(segments) && segments.length, 'Figure type needs segments');
  return { figure_type_id: id, name, segment_count: segments.length, segments: structuredClone(segments), polyfills: [], image_assets: [], text_assets: [] };
}
function imageType(id, name, asset) {
  positive(asset.w, 'image scene width');
  positive(asset.h, 'image scene height');
  integer(asset.pixelWidth, 'image pixel width');
  integer(asset.pixelHeight, 'image pixel height');
  check(typeof asset.data_url === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(asset.data_url), 'Image needs an embedded PNG data URL');
  const png = Buffer.from(asset.data_url.split(',')[1], 'base64');
  check(png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'Invalid PNG signature');
  check(png.readUInt32BE(16) === asset.pixelWidth && png.readUInt32BE(20) === asset.pixelHeight, 'PNG dimensions do not match asset metadata');
  check(Math.abs(asset.w / asset.h - asset.pixelWidth / asset.pixelHeight) < 1e-6, 'PNG and scene aspect ratios must match');
  const s = segment(1, 0, asset.w / 2, 0, '#000000', name);
  Object.assign(s, { primitive_code: 2, flags: 2, segment_type: 'image', segment_kind: 'image', extra_u16: 0, extra_u8_a: 0, extra_u8_b: 0, extra: [0, 0, 0] });
  const type = figureType(id, name, [s]);
  type.image_assets.push({
    kind: 'image', asset_index: 0, table_index: 0, mime_type: 'image/png',
    width: asset.pixelWidth, height: asset.pixelHeight, data_url: asset.data_url,
    anchor_start: { x: asset.pixelWidth / 2, y: asset.pixelHeight / 2 },
    anchor_end: { x: asset.pixelWidth, y: asset.pixelHeight / 2 },
    anchor_length: asset.pixelWidth / 2, anchor_angle_rad: 0
  });
  return type;
}
function object({ id, typeId, x, y, angles, scale = 1, opacity = 1, lengths }) {
  integer(id, 'object id'); integer(typeId, 'object type id');
  finite(x, 'x'); finite(y, 'y'); positive(scale, 'scale');
  check(Array.isArray(angles) && angles.length && angles.every(Number.isFinite), 'Object needs finite joint angles');
  check(Number.isFinite(opacity) && opacity >= 0 && opacity <= 1, 'Opacity must be between 0 and 1');
  if (lengths) check(lengths.length === angles.length && lengths.every(n => Number.isFinite(n) && n > 0), 'Length overrides must match angles and be positive');
  return {
    object_slot: 0, unique_id: id, figure_type_id: typeId, root_x: x, root_y: y, scale,
    color_override_raw: 0, field28: Math.round((1 - opacity) * 255),
    angles: [...angles], len_flag: lengths ? 1 : 0, lengths: lengths ? [...lengths] : [],
    bend_flag: 0, bends: [], join: null
  };
}

function createRig(options = {}) {
  const c = {
    torso: 45, head: 28, upper: 28, fore: 26, thigh: 34, shin: 34, width: 8,
    color: '#315f63', farColor: '#598086', scarfColor: '#edbf59', ...options
  };
  integer(c.id, 'rig id');
  for (const key of ['torso', 'head', 'upper', 'fore', 'thigh', 'shin', 'width']) positive(c[key], key);
  check(c.width > 1, 'Rig width must exceed 1');
  const s = [
    segment(1, 0, c.torso, c.width + 2, c.color, 'Torso'),
    segment(2, 1, c.head, 0, c.color, 'Head', 'circleFill'),
    segment(3, 1, c.upper, c.width - 1, c.farColor, 'Far upper arm'),
    segment(4, 3, c.fore, c.width - 1, c.farColor, 'Far forearm'),
    segment(5, 1, c.upper, c.width, c.color, 'Near upper arm'),
    segment(6, 5, c.fore, c.width, c.color, 'Near forearm'),
    segment(7, 0, c.thigh, c.width, c.farColor, 'Far thigh'),
    segment(8, 7, c.shin, c.width, c.farColor, 'Far shin'),
    segment(9, 0, c.thigh, c.width, c.color, 'Near thigh'),
    segment(10, 9, c.shin, c.width, c.color, 'Near shin'),
    segment(11, 8, 9, c.width + 1, '#3a504b', 'Far shoe'),
    segment(12, 10, 9, c.width + 1, '#3a504b', 'Near shoe'),
    segment(13, 1, 11, 9, c.scarfColor ?? c.color, 'Collar'),
    segment(14, 1, 21, 7, c.scarfColor ?? c.color, 'Scarf tail'),
    segment(15, 14, 13, 6, c.scarfColor ?? c.color, 'Scarf tip'),
    segment(16, 1, 1, 0, c.color, 'Eye anchor'),
    segment(17, 16, 3, 0, '#fff5d9', 'Eye', 'circleFill')
  ];
  s[15].visible = false;
  if (c.scarfColor === null) for (const index of [12, 13, 14]) s[index].visible = false;
  return { ...c, type: figureType(c.id, c.name, s) };
}
function validatePose(p) {
  xy(p.hip, 'hip'); finite(p.torso, 'torso angle'); finite(p.head, 'head angle');
  check(p.facing === 1 || p.facing === -1, 'Facing must be +1 or -1');
  for (const key of ['feet', 'hands']) {
    check(Array.isArray(p[key]) && p[key].length === 2, `Pose needs two ${key}`);
    p[key].forEach(v => xy(v, key));
  }
}
function standing(rig, x, ground, facing = 1) {
  finite(x, 'standing x'); finite(ground, 'ground');
  const legLength = rig.thigh + rig.shin;
  const hip = [x, ground - legLength + Math.min(7, legLength * .1)];
  const neck = add(hip, vector(-Math.PI / 2, rig.torso));
  const p = {
    hip, torso: -Math.PI / 2, head: -Math.PI / 2, facing,
    feet: [[x - 8, ground], [x + 8, ground]],
    hands: [[neck[0] - 12, neck[1] + rig.upper + rig.fore - 5], [neck[0] + 17, neck[1] + rig.upper + rig.fore - 8]]
  };
  validatePose(p);
  return p;
}
function crouching(rig, { x, ground, height = 27, facing = 1, lean = 20 }) {
  positive(height, 'hip height'); finite(lean, 'lean');
  const p = standing(rig, x, ground, facing);
  p.hip = [x - facing * 6, ground - height];
  p.torso = radians(-90 + facing * lean); p.head = radians(-90 + facing * 12);
  const neck = add(p.hip, vector(p.torso, rig.torso));
  p.hands = [[neck[0] - 4, neck[1] + rig.upper + rig.fore - 9], [neck[0] + 14, neck[1] + rig.upper + rig.fore - 10]];
  return p;
}
function carrying(rig, pose, center, grip = 10, offsetY = 7) {
  validatePose(pose); positive(grip, 'grip'); finite(offsetY, 'grip offset');
  const p = structuredClone(pose), neck = add(p.hip, vector(p.torso, rig.torso));
  center ??= [neck[0] + p.facing * 28, neck[1] + 23];
  xy(center, 'prop center');
  p.hands = [[center[0] - grip, center[1] + offsetY], [center[0] + grip, center[1] + offsetY]];
  return p;
}
function blendPose(a, b, progress) {
  validatePose(a); validatePose(b);
  check(a.facing === b.facing, 'Do not blend opposing bend directions; author a separate turning pose');
  const u = clamp(finite(progress, 'pose progress'));
  return {
    hip: mixPoint(a.hip, b.hip, u), torso: mix(a.torso, b.torso, u), head: mix(a.head, b.head, u), facing: a.facing,
    feet: a.feet.map((p, i) => mixPoint(p, b.feet[i], u)),
    hands: a.hands.map((p, i) => mixPoint(p, b.hands[i], u))
  };
}
function track(keys, { poses = false, easing = 'smooth' } = {}) {
  check(Array.isArray(keys) && keys.length, 'Track needs keys');
  check(['smooth', 'linear', 'constant'].includes(easing), 'Unknown track easing');
  const copy = structuredClone(keys);
  copy.forEach(([time, value], i) => {
    finite(time, 'key time');
    check(i === 0 || time > copy[i - 1][0], 'Track times must strictly increase');
    if (poses) validatePose(value);
    else check(Array.isArray(value) && value.length > 0 && value.every(Number.isFinite) && value.length === copy[0][1].length, 'Track values must be equal-length numeric vectors');
  });
  return t => {
    finite(t, 'track time');
    if (t <= copy[0][0]) return structuredClone(copy[0][1]);
    for (let i = 1; i < copy.length; i++) if (t < copy[i][0]) {
      let u = (t - copy[i - 1][0]) / (copy[i][0] - copy[i - 1][0]);
      u = easing === 'constant' ? 0 : easing === 'smooth' ? smooth(u) : u;
      return poses ? blendPose(copy[i - 1][1], copy[i][1], u) : copy[i][1].map((v, n) => mix(copy[i - 1][1][n], v, u));
    }
    return structuredClone(copy.at(-1)[1]);
  };
}
function solveTwoBone(start, target, first, second, side = 1) {
  xy(start, 'IK start'); xy(target, 'IK target');
  positive(first, 'first bone'); positive(second, 'second bone');
  check(side === 1 || side === -1, 'IK side must be +1 or -1');
  const d = Math.hypot(target[0] - start[0], target[1] - start[1]);
  const min = Math.abs(first - second), max = first + second;
  check(d >= min - 1e-7 && d <= max + 1e-7, `Unreachable IK target: distance ${d.toFixed(4)}, allowed ${min}..${max}`);
  if (d < 1e-10) return { joint: [start[0] + first, start[1]], end: [...target], angles: [0, Math.PI] };
  const theta = angleBetween(start, target), reach = Math.max(min, Math.min(max, d));
  const a = (first * first - second * second + reach * reach) / (2 * reach);
  const h = Math.sqrt(Math.max(0, first * first - a * a));
  const joint = [start[0] + a * Math.cos(theta) - side * h * Math.sin(theta), start[1] + a * Math.sin(theta) + side * h * Math.cos(theta)];
  return { joint, end: [...target], angles: [angleBetween(start, joint), angleBetween(joint, target)] };
}
function walkPose(rig, { fromX, toX, start, end, time, ground, stride = 40, lift = 11 }) {
  [fromX, toX, start, end, time, ground].forEach(n => finite(n, 'walk parameter'));
  check(end > start, 'Walk end must be after start'); positive(stride, 'stride'); positive(lift, 'foot lift');
  const facing = Math.sign(toX - fromX) || 1;
  const d = Math.abs(toX - fromX) * smooth((time - start) / (end - start));
  const x = fromX + facing * d, q = d / stride;
  const p = standing(rig, x, ground, facing);
  p.hip[1] += 1.5 * Math.cos(q * Math.PI * 4); p.torso += facing * radians(4);
  const contacts = [];
  p.feet = [0, .5].map(phase => {
    const cycle = q + phase, n = Math.floor(cycle), f = cycle - n;
    const anchor = fromX + facing * ((n - phase) * stride + stride * .3);
    contacts.push({ planted: f < .6, cycle: n, anchor });
    if (f < .6) return [anchor, ground];
    const swing = (f - .6) / .4;
    return [anchor + facing * stride * smooth(swing), ground - lift * Math.sin(Math.PI * swing)];
  });
  const neck = add(p.hip, vector(p.torso, rig.torso)), swing = Math.sin(q * Math.PI * 2) * 17;
  p.hands = [[neck[0] + swing, neck[1] + rig.upper + rig.fore - 10], [neck[0] - swing, neck[1] + rig.upper + rig.fore - 10]];
  return { pose: p, contacts };
}
function solveActor(rig, pose, { id = rig.id, time = 0, flutter = 0 } = {}) {
  validatePose(pose); finite(time, 'time'); finite(flutter, 'flutter');
  const neck = add(pose.hip, vector(pose.torso, rig.torso)), s = pose.facing;
  const arms = pose.hands.map((h, i) => solveTwoBone(neck, h, rig.upper, rig.fore, i ? s : -s));
  const legs = pose.feet.map(f => solveTwoBone(pose.hip, f, rig.thigh, rig.shin, -s));
  const eye = [s * 6.3, -rig.head * .52];
  const scarf = (s > 0 ? Math.PI - .15 : .15) + .1 * Math.sin(time * 4.7) + flutter;
  const angles = [pose.torso, pose.head, ...arms[0].angles, ...arms[1].angles, ...legs[0].angles, ...legs[1].angles,
    s > 0 ? 0 : Math.PI, s > 0 ? 0 : Math.PI, s > 0 ? 0 : Math.PI, scarf, scarf + .25, Math.atan2(eye[1], eye[0]), -Math.PI / 2];
  const lengths = rig.type.segments.map(segment => segment.length);
  lengths[15] = Math.hypot(...eye);
  return {
    object: object({ id, typeId: rig.id, x: pose.hip[0], y: pose.hip[1], angles, lengths }),
    neck, headTop: add(neck, vector(pose.head, rig.head)), hands: arms.map(a => a.end), feet: legs.map(l => l.end)
  };
}
function heldCenter(actor, offsetY = -7) {
  finite(offsetY, 'held prop offset');
  return [(actor.hands[0][0] + actor.hands[1][0]) / 2, (actor.hands[0][1] + actor.hands[1][1]) / 2 + offsetY];
}

function validateMovie(movie) {
  check(movie.version === 5, 'Only version-5 JSON is supported');
  integer(movie.canvas_width, 'canvas width'); integer(movie.canvas_height, 'canvas height'); integer(movie.fps, 'fps');
  check(Array.isArray(movie.figure_types) && movie.figure_types.length, 'Movie has no figure types');
  const types = new Map();
  for (const t of movie.figure_types) {
    integer(t.figure_type_id, 'type id');
    check(!types.has(t.figure_type_id), 'Duplicate figure type id');
    check(t.segment_count === t.segments.length && t.segment_count > 0, 'Segment count mismatch');
    const seen = new Set([0]);
    for (const s of t.segments) {
      integer(s.segment_id, 'segment id'); positive(s.length, 'segment length');
      check(!seen.has(s.segment_id) && seen.has(s.parent_id), 'Segments must have unique IDs and precede their children');
      seen.add(s.segment_id);
    }
    types.set(t.figure_type_id, t);
  }
  check(Array.isArray(movie.keyframes) && movie.keyframes.length, 'Movie has no frames');
  const assignments = new Map();
  for (const [index, frame] of movie.keyframes.entries()) {
    check(frame.duration_raw === 1, 'Dense JSON requires duration_raw=1; use the app for sparse-key timing');
    check(Array.isArray(frame.objects), `Missing objects at frame ${index + 1}`);
    const seen = new Set();
    for (const [slot, o] of frame.objects.entries()) {
      integer(o.unique_id, 'object id');
      check(!seen.has(o.unique_id), `Duplicate object at frame ${index + 1}`);
      seen.add(o.unique_id);
      const t = types.get(o.figure_type_id);
      check(t, `Unknown type at frame ${index + 1}`);
      check(!assignments.has(o.unique_id) || assignments.get(o.unique_id) === o.figure_type_id, 'Object type changes across frames');
      assignments.set(o.unique_id, o.figure_type_id);
      check(o.object_slot === slot, 'Object slots must match draw order');
      finite(o.root_x, 'root x'); finite(o.root_y, 'root y'); positive(o.scale, 'object scale');
      check(Array.isArray(o.angles) && o.angles.length === t.segment_count && o.angles.every(Number.isFinite), `Invalid angles at frame ${index + 1}`);
      check(Number.isInteger(o.field28) && o.field28 >= 0 && o.field28 <= 255, 'field28 opacity byte must be 0..255');
      if (o.len_flag) check(Array.isArray(o.lengths) && o.lengths.length === t.segment_count && o.lengths.every(n => Number.isFinite(n) && n > 0), 'Invalid length overrides');
    }
    check(JSON.stringify(frame.object_draw_order) === JSON.stringify(frame.objects.map((_, i) => i)), 'Invalid draw-order slots');
    check(JSON.stringify(frame.object_draw_order_unique_ids) === JSON.stringify(frame.objects.map(o => o.unique_id)), 'Invalid draw-order IDs');
  }
  return { frames: movie.keyframes.length, fps: movie.fps, seconds: movie.keyframes.length / movie.fps, types: types.size, objects: assignments.size };
}
function createMovie({ name, width = 960, height = 540, fps = 24, seconds, types, sample }) {
  check(typeof name === 'string' && name.trim(), 'Movie needs a name');
  integer(width, 'width'); integer(height, 'height'); integer(fps, 'fps'); positive(seconds, 'seconds');
  const count = seconds * fps;
  check(Number.isSafeInteger(count), 'Duration must correspond to a whole number of frames');
  check(typeof sample === 'function', 'Movie needs a sample(time, frame) function');
  const frames = Array.from({ length: count }, (_, i) => {
    const result = sample(i / fps, i);
    check(Array.isArray(result), `sample must return an object array at frame ${i + 1}`);
    const objects = structuredClone(result).map((o, slot) => ({ ...o, object_slot: slot, _stykZIndex: slot }));
    return {
      duration_raw: 1, background_id: 0, background_id_b: 0, background_mix: 0,
      camera: { is_default: true, x: 0, y: 0, scale: 1, angle_rad: 0 },
      objects, object_draw_order: objects.map((_, i) => i), object_draw_order_unique_ids: objects.map(o => o.unique_id),
      _styk: { easing: { interpolation: i === count - 1 ? 'constant' : 'linear' }, frameId: `frame-${i + 1}` }
    };
  });
  const movie = {
    version: 5, canvas_width: width, canvas_height: height, fps,
    auto_easing: false, auto_easing_disabled_raw: 1, auto_easing_source: 'file',
    backgrounds: [], figure_types: structuredClone(types), keyframes: frames,
    _styk: { format: 'StykAnimate', format_version: 1, name }
  };
  validateMovie(movie);
  return movie;
}
function writeMovie(filename, movie, { overwrite = false } = {}) {
  const result = validateMovie(movie);
  fs.writeFileSync(filename, JSON.stringify(movie), { flag: overwrite ? 'w' : 'wx' });
  return { file: filename, ...result };
}
module.exports = {
  smooth, mix, mixPoint, radians, segment, figureType, imageType, object,
  createRig, standing, crouching, carrying, blendPose, track, solveTwoBone, walkPose, solveActor, heldCenter,
  createMovie, validateMovie, writeMovie
};
