# Security

Ambient journaling web app (Vite) and iPhone app (Capacitor).

## Reporting a vulnerability

Please report security issues privately through GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting is enabled). Don't open a public issue for security problems.

## Automated protections (always on)

| Protection | Status |
|---|---|
| GitHub secret scanning | Enabled |
| Push protection (blocks commits that contain secrets) | Enabled |
| Dependabot vulnerability alerts | Enabled |
| Private vulnerability reporting | Enabled |

## Checks run on 2026-10-16

| Check | Result |
|---|---|
| Secret patterns (AWS, GitHub, OpenAI, Anthropic, Slack, Google, Twilio, Hugging Face keys; private keys; hard-coded tokens) in every file **and every past commit** | ✅ None found |
| Credential files ever committed (`.env`, `*.pem`, `*.key`, `id_rsa`, credentials) | ✅ None found |
| GitHub secret-scanning alerts | ✅ 0 open alerts |
| `npm audit --omit=dev` (runtime dependencies) | ✅ 0 known vulnerabilities |
| `npm audit` (development tooling) | ✅ 0 known vulnerabilities since 2026-10-22: `uuid` is forced to ^11.1.1 (`overrides` in `package.json`); it was pulled in at an older version by `@capacitor/cli` → `xcode` (iOS build tooling, never shipped to users). Closes Dependabot alert #1. |
| CI workflow review (`deploy.yml`) | ✅ Least-privilege token (`contents: read`, plus Pages deploy only); lint runs before build; no `pull_request_target` triggers |
| Content Security Policy | ✅ Present (`vite.config.js`) |

## Not covered

These checks are automated and point-in-time. They are not a penetration test or a formal audit.
