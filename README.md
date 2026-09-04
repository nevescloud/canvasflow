# CanvasFlow

Every Canvas deadline in one panel. A Chrome extension for students on Canvas LMS: assignments from every course in one list, ranked by what needs you first, with practice quizzes and reading aids from Chrome's built-in AI on your own machine. No account, no server of its own, and your coursework stays in the browser.

[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/plodbfednbjngcmckbcilgpkhgijgado) · [Site](https://neves.cloud/canvasflow/) · [Privacy policy](https://neves.cloud/canvasflow/privacy.html)

## Feedback and requests

[Send feedback](https://neves.cloud/canvasflow/feedback.html) needs no GitHub account: it posts here as an issue and hands you a link to follow. With an account, [open an issue](https://github.com/nevescloud/canvasflow/issues/new/choose) directly.

Issues are public. Leave out your name, email, and school login.

## This repository

| Path | What it is |
|---|---|
| `docs/` | The site, served by GitHub Pages at neves.cloud/canvasflow |
| `api/` | The Cloudflare Worker behind the feedback form. It validates a submission, rate-limits it, and opens the issue. |
| `.github/ISSUE_TEMPLATE/` | The issue forms |

The extension's source is not published here.

CanvasFlow is an independent project, not affiliated with or endorsed by Instructure. MIT license.
