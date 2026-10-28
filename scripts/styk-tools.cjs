#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const A = require('./animation.cjs');
const F = require('./formats.cjs');
const B = require('./browser.cjs');
const P = require('./production.cjs');
const help = `StykAnimate toolkit (Node.js 24; no packages required)

Start here (from the skill directory):
  npm run setup                      Install for your personal Copilot host
  npm run setup -- <skills-directory> Install in a different skills directory
  npm run demo -- <new-directory>     Prepare and validate a silent 10-second demo
  npm run tools -- --help             Show all commands

Equivalent direct commands:
  node styk-tools.cjs setup [skills-directory]
  node styk-tools.cjs quickstart [new-directory]

Advanced commands:
  node styk-tools.cjs demo <new-output.json>
  node styk-tools.cjs validate <movie.json>
  node styk-tools.cjs inspect-mp4 <movie.mp4>
  node styk-tools.cjs inspect-native <movie.styk>
  node styk-tools.cjs verify <movie.mp4> <movie.styk> <expected.json>
  node styk-tools.cjs browser <operation> <options.json>
  node styk-tools.cjs doctor
  node styk-tools.cjs storyboard <beats.json> <new-plan.json>
  node styk-tools.cjs expectations <movie.json> <export-options.json> <new-expected.json>
  node styk-tools.cjs audio <cues.json> <new-soundtrack.wav>
  node styk-tools.cjs inspect-wav <soundtrack.wav>

Browser operations:
  ${B.operations.join(', ')}

The browser command EMITS a runPlaywrightCode argument object; it does not
launch a browser. Discover that browser tool, then submit the emitted object.
Demo refuses to overwrite files. Verification failures exit nonzero.
Read references/tools.md for option schemas and the authoring API.`;

function quickstart(directory = 'stykanimate-demo') {
  P.doctor();
  const target = path.resolve(directory);
  if (fs.existsSync(target)) throw new Error(`Demo destination already exists: ${target}. Choose a new directory.`);
  const movie = require('../examples/walk-and-wave.cjs')();
  const info = A.validateMovie(movie);
  const expected = P.expectations(movie);
  const staging = fs.mkdtempSync(path.join(path.dirname(target), '.stykanimate-demo-'));
  try {
    A.writeMovie(path.join(staging, 'movie.json'), movie);
    P.writeJson(path.join(staging, 'expected.json'), expected);
    fs.renameSync(staging, target);
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true });
  }
  return {
    directory: target, ...info,
    movie: path.join(target, 'movie.json'),
    expectations: path.join(target, 'expected.json'),
    next: 'Local demo validated; no browser or video export was run. Ask the agent to import movie.json into a backed-up StykAnimate page, preview, save native STYK, export a silent 1080p MP4, and verify with expected.json.'
  };
}

function main(args) {
  const [command, ...rest] = args;
  const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
  const arity = n => { if (rest.length !== n) throw new Error(`Expected ${n} argument(s) for ${command}; run --help`); };
  if (!command || command === '--help') return help;
  if (command === 'setup' || command === 'quickstart') {
    if (rest.length > 1 || (rest.length === 1 && !rest[0].trim())) throw new Error(`Expected at most one nonempty directory for ${command}; run --help`);
    if (command === 'setup') return require('./release.cjs').install(rest[0] ?? path.join(os.homedir(), '.copilot', 'skills'));
    return quickstart(rest[0]);
  }
  if (command === 'doctor') { arity(0); return P.doctor(); }
  if (command === 'storyboard') { arity(2); const plan = P.storyboard(read(rest[0])); return { ...P.writeJson(rest[1], plan), frames: plan.frames, seconds: plan.seconds }; }
  if (command === 'expectations') { arity(3); return P.writeJson(rest[2], P.expectations(read(rest[0]), read(rest[1]))); }
  if (command === 'audio') {
    arity(2);
    const audio = P.synthesizeAudio(read(rest[0]));
    fs.writeFileSync(rest[1], audio, { flag: 'wx' });
    return { file: rest[1], ...P.inspectWav(audio) };
  }
  if (command === 'inspect-wav') { arity(1); return P.inspectWav(fs.readFileSync(rest[0])); }
  if (command === 'demo') { arity(1); return A.writeMovie(rest[0], require('../examples/walk-and-wave.cjs')()); }
  if (command === 'validate') { arity(1); return A.validateMovie(read(rest[0])); }
  if (command === 'inspect-mp4') { arity(1); return F.inspectMp4(fs.readFileSync(rest[0])); }
  if (command === 'inspect-native') { arity(1); return F.inspectNative(fs.readFileSync(rest[0])); }
  if (command === 'verify') { arity(3); return { verified: true, ...F.verify(fs.readFileSync(rest[0]), fs.readFileSync(rest[1]), read(rest[2])) }; }
  if (command === 'browser') { arity(2); return B.makeCall(rest[0], read(rest[1])); }
  throw new Error(`Unknown command: ${command}; run --help`);
}
if (require.main === module) {
  try {
    const result = main(process.argv.slice(2));
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(`StykAnimate tools: ${error.message}`);
    process.exitCode = 1;
  }
}
module.exports = { main };
