# Changelog

## 0.1.0 - release candidate

- Package the existing animation/IK, browser and file-inspection toolkit as a
  self-contained MIT-licensed agent skill.
- Add portable runtime diagnostics, frame-accurate storyboards, generated output
  specifications, original PCM16 WAV cues and WAV inspection.
- Add optional MP4 audio-track verification without breaking legacy specs.
- Add read-only browser scene inspection and experimental guarded audio import.
- Keep browser-host APIs separate from page globals; scene inspection is tested
  in a restricted execution context as well as the live app.
- Add safe installation, deterministic release ZIPs and SHA-256 manifests.
- Add installation, contribution and publishing guides and three-OS CI.

Local verification: Windows with Node.js 24. Cross-OS CI and full audio browser
acceptance remain release gates; packaging does not imply those gates passed.
