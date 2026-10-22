#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const A = require('./animation.cjs');
const F = require('./formats.cjs');
const B = require('./browser.cjs');
const P = require('./production.cjs');
const help = `StykAnimate toolkit (Node.js 24; no packages required)

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

function main(args) {
  const [command, ...rest] = args;
  const read = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
  const arity = n => { if (rest.length !== n) throw new Error(`Expected ${n} argument(s) for ${command}; run --help`); };
  if (!command || command === '--help') return help;
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
