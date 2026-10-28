# Publishing plan

Target: a public GitHub repository and a versioned downloadable ZIP.
License selected: MIT. **No repository, remote push, tag, or public release has
been created by this preparation.**

Run from the skill source directory, **not the surrounding workspace**, which
contains private film deliverables. Examples use a terminal and native paths.
Replace `OWNER` and `REPOSITORY` deliberately; they are placeholders.

## 1. Confirm ownership and public scope

- Confirm you can license all bundled code, documentation and original examples.
- Review [LICENSE](./LICENSE); replace the contributor attribution if needed.
- Keep user films, screenshots of private work, audio recordings, browser
  storage, credentials, machine paths and session logs out of the repository.
- Do not copy the StykAnimate app's source, branding or stock assets into this
  package. State that this is an independent toolkit.
- Review every tracked file before the first public push. `.gitignore` is not a
  license review and does not remove already-tracked files.

## 2. Validate the candidate locally

Install Node.js 24 or newer. No dependency installation is needed.

```text
node scripts/styk-tools.cjs doctor
npm test
npm run check
```

Follow the [README local demo](./README.md) using
`npm run demo -- "<new-temporary-output-directory>"`. Verify refusal to
overwrite. Separately generate and inspect the example WAV using the
[production commands](./references/production.md); the quick demo is silent.

## 3. Complete manual app acceptance

Use a separate/backed-up project. For each supported browser host:

1. Confirm that the agent discovers the installed skill and browser tools.
2. Import the 240-key demo, preview feet, wave and ending.
3. Save native STYK, export 10-second 24 fps 1080p MP4, and run `verify`.
4. Run decoded-frame verification and inspect its contact sheet.
5. Reopen the STYK and confirm the name, scenery, actor and duration.
6. For optional audio, import the example WAV, verify start=0 and duration=10,
   listen to cues, save/reopen, export and require one audio track.
7. Exercise download fallback only if a real native picker problem occurs;
   restore the original picker afterward.
8. Record OS, Node, agent host, browser version and date. Do not mark
   unexecuted tests as passing.

Audio import remains experimental until step 6 succeeds. Metadata checks cannot
replace listening or visual review.

## 4. Create a source repository

Use the **skill directory as the repository root** so the included
`.github/workflows/ci.yml` runs. Do not initialize the surrounding movie folder.
If it is already tracked, review the existing Git state instead of reinitializing.

```text
git init -b main
git add SKILL.md README.md LICENSE CHANGELOG.md PUBLISHING.md CONTRIBUTING.md package.json .gitignore scripts references examples tests .github
git diff --cached --stat
git diff --cached
git commit -m "Prepare StykAnimate movie skill v0.1.0" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Inspect the complete staged content before committing. Use your actual identity
in Git config. Do not commit authentication tokens.

## 5. Create and push to GitHub (public disclosure checkpoint)

Authenticate with `gh auth login`, then explicitly approve public sharing.
Run these only when ready:

```text
gh repo create OWNER/REPOSITORY --public --source . --remote origin
git push -u origin main
gh run list --limit 5
```

Choose a descriptive repository name, such as `stykanimate-movie-skill`.
If a remote already exists, inspect it rather than replacing it.
Wait for **all three** CI jobs (Windows, Ubuntu, macOS) to pass; inspect failed
runs with `gh run view RUN_ID --log-failed`.

The workflow is included but cannot run as-is from the surrounding non-Git
workspace. No Linux/macOS results are claimed until this matrix actually runs.
Complete browser acceptance on each OS before claiming end-to-end support.

## 6. Finalize version and release notes

- Start with `0.1.0` (or `0.1.0-rc.1` as a Git tag for the candidate).
- Keep `package.json`, changelog, README status and tag consistent.
- Document the OS/browser results and known limitations honestly.
- Re-run tests and `npm run check` after final edits, then commit and push.
- The package is private to avoid accidental npm publication; npm publishing
  is neither required nor configured.

## 7. Build and inspect the release ZIP

Create an output directory **outside** the source skill directory and run:

```text
node scripts/release.cjs pack "<output-directory>/stykanimate-movie-skill-v0.1.0.zip"
```

Use native path separators. The command prints SHA-256, bytes and entry count.
It refuses overwrite and includes only toolkit source, docs, tests, examples and
CI. The ZIP contains one `stykanimate-movie-skill` folder and a `MANIFEST.json` listing
per-file SHA-256 hashes. Packaging is deterministic for identical source bytes.

Open the ZIP with the OS archive tool. Confirm:

- No films, external artwork, user audio, credentials, logs or personal paths.
- `SKILL.md`, MIT license, scripts, examples and tests are present.
- Extracted files pass `npm test` and `npm run check`.
- Install the extracted copy into a clean temporary skills directory and verify
  host discovery. Installation must not require this workspace.
- Compare the ZIP SHA-256 with `Get-FileHash` (PowerShell) or `shasum -a 256`
  (macOS) / `sha256sum` (Linux). Record it in the release notes.

## 8. Publish the tagged release

After approval and successful tests:

```text
git tag -a v0.1.0 -m "StykAnimate movie skill v0.1.0"
git push origin v0.1.0
gh release create v0.1.0 "<output-directory>/stykanimate-movie-skill-v0.1.0.zip" --verify-tag --title "StykAnimate movie skill v0.1.0" --notes-file "<release-notes-file>"
```

Prepare a release-notes file with install commands, Node/browser requirements,
checksums, test results, experimental features and limitations. Do not use the
planning checklist as if it were completed release evidence.
For a candidate, tag `v0.1.0-rc.1` consistently and add `--prerelease`.

## 9. Help others find and use it

- Add repository topics such as `agent-skills`, `copilot`, `animation` and
  `stykanimate`.
- Link the README install instructions and release ZIP in the repository About.
- Optionally submit the repository to skill directories after checking their
  current submission format; no universal skill marketplace is assumed.
- Share only an original, authorized demo. A screenshot/video is optional and
  excluded from the toolkit release unless separately reviewed.
- Ask a new user on a second machine to install from the release, not your local
  workspace. Fix friction before marking the release stable.

## 10. Maintain and upgrade

Review incoming issues without requesting private STYK projects or logs publicly.
For a website UI change, update locators, regression tests and dated compatibility
notes. For each release, repeat the three-OS tests and relevant browser acceptance.
Installers deliberately refuse replacement: back up/remove an old skill
explicitly, then install the new one. Never overwrite user films during upgrades.
