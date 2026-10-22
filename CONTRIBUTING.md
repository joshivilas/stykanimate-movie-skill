# Contributing

Use Node.js 24 or newer; no dependency installation is needed.
Run `npm test`, `npm run doctor` and `npm run check` from this directory.
The CI matrix repeats these checks on Windows, Linux and macOS.

- Keep scripts dependency-free, CommonJS, and portable via Node filesystem/path
  APIs. Never assume a username, drive letter, Downloads directory or shell.
- Preserve existing work. New output paths must refuse accidental overwrite.
- Add focused tests for new behavior and explicit failure paths. Browser-call
  syntax tests do not prove the app's selectors or workflows work.
- Use ordinary UI/file import, not mutation of private editor state.
- Test a browser change on a disposable/backed-up project and record date,
  browser host, OS, save/reopen and exported-file evidence.
- Keep broad instructions in SKILL.md concise; put detailed schemas in references.
- Update directly related docs and CHANGELOG.md.
- Do not include user projects, licensed assets, secrets or session history.
- Report dependency/security concerns privately to the repository owner via an
  available private GitHub reporting channel; do not post exploit data or secrets
  publicly. The publisher must configure that channel before advertising it.

Contributions are provided under the repository's MIT license. You must have
permission to contribute them. The app and third-party assets keep their own
licenses and terms.
