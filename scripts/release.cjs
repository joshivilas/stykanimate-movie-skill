#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { doctor } = require('./production.cjs');
const root = path.resolve(__dirname, '..');
const metadata = require('../package.json');
const topFiles = ['SKILL.md', 'README.md', 'LICENSE', 'CHANGELOG.md', 'PUBLISHING.md', 'CONTRIBUTING.md', 'package.json', '.gitignore'];
const directories = ['scripts', 'references', 'examples', 'tests', '.github'];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function releaseFiles() {
  const names = [...topFiles];
  function walk(dir) {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name);
      requireValue(!entry.isSymbolicLink(), `Release cannot include symlinks: ${relative}`);
      if (entry.isDirectory()) walk(relative);
      else {
        requireValue(entry.isFile() && /\.(cjs|json|md|yml|yaml)$/.test(entry.name), `Unexpected release file: ${relative}`);
        names.push(relative);
      }
    }
  }
  directories.forEach(walk);
  return names.sort().map(name => {
    const filename = path.join(root, name);
    requireValue(fs.lstatSync(filename).isFile() && !fs.lstatSync(filename).isSymbolicLink(), `Not a regular release file: ${name}`);
    return { name: name.split(path.sep).join('/'), data: fs.readFileSync(filename) };
  });
}
function check() {
  doctor();
  const files = releaseFiles();
  const skill = files.find(f => f.name === 'SKILL.md').data.toString('utf8');
  requireValue(/^---\r?\nname: stykanimate-movie-skill\r?\ndescription: '[^\r\n]+'\r?\n/.test(skill), 'Invalid skill frontmatter');
  requireValue(skill.split('\n').length < 500, 'Keep SKILL.md under 500 lines');
  requireValue(/^\d+\.\d+\.\d+$/.test(metadata.version), 'Version must be major.minor.patch');
  requireValue(metadata.license === 'MIT', 'Release license must match LICENSE');
  const names = new Set(files.map(f => f.name));
  for (const file of files.filter(f => f.name.endsWith('.md'))) {
    for (const match of file.data.toString('utf8').matchAll(/\]\((\.\.?\/[^)#]+)(?:#[^)]*)?\)/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file.name), match[1]));
      requireValue(names.has(target), `Broken local link in ${file.name}: ${match[1]}`);
    }
  }
  return { ready: true, version: metadata.version, files: files.length, platforms: 'Windows validated locally; Linux/macOS require CI and manual browser smoke tests' };
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [], central = [];
  let offset = 0, centralSize = 0;
  for (const { name, data } of entries) {
    const filename = Buffer.from(`stykanimate-movie-skill/${name}`), crc = crc32(data);
    requireValue(data.length < 0xffffffff && offset < 0xffffffff, 'ZIP64 is not supported');
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(33, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(33, 14); directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
    local.push(header, filename, data); central.push(directory, filename);
    offset += header.length + filename.length + data.length;
    centralSize += directory.length + filename.length;
  }
  requireValue(entries.length <= 65535 && offset + centralSize < 0xffffffff, 'Release exceeds ZIP limits');
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}
function outsideSource(destination) {
  const relative = path.relative(root, path.resolve(destination));
  requireValue(relative !== '' && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)), 'Destination must be outside the source skill directory');
}
function pack(file) {
  check();
  outsideSource(file);
  requireValue(path.extname(file).toLowerCase() === '.zip', 'Release output must end in .zip');
  const files = releaseFiles();
  const manifest = { name: metadata.name, version: metadata.version, files: files.map(f => ({ path: f.name, bytes: f.data.length, sha256: hash(f.data) })) };
  files.push({ name: 'MANIFEST.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') });
  const data = zip(files);
  fs.writeFileSync(file, data, { flag: 'wx' });
  return { file: path.resolve(file), bytes: data.length, sha256: hash(data), entries: files.length };
}
function install(skillsDirectory) {
  check();
  const target = path.resolve(skillsDirectory, 'stykanimate-movie-skill');
  outsideSource(target);
  requireValue(!fs.existsSync(target), `Installation already exists: ${target}. Back it up and remove it explicitly before upgrading.`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(target), '.stykanimate-install-'));
  try {
    for (const { name, data } of releaseFiles()) {
      const file = path.join(staging, ...name.split('/'));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, data, { flag: 'wx' });
    }
    fs.renameSync(staging, target);
  } finally {
    if (fs.existsSync(staging)) fs.rmSync(staging, { recursive: true });
  }
  return { installed: target, next: 'Reload your agent host and invoke /stykanimate-movie-skill. Browser automation must be supplied by the host.' };
}
function main(args) {
  const [command, ...rest] = args;
  if (command === 'check' && rest.length === 0) return check();
  if (command === 'pack' && rest.length === 1) return pack(rest[0]);
  if (command === 'install' && rest.length === 1) return install(rest[0]);
  throw new Error('Usage: node scripts/release.cjs check | pack <new-release.zip> | install <skills-directory>');
}
if (require.main === module) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(`StykAnimate release: ${error.message}`); process.exitCode = 1; }
}
module.exports = { check, releaseFiles, crc32, pack, install };
