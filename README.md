# DevFinder — Codveda Level 2 (Intermediate)

A standalone React application for searching public GitHub profiles and keeping a personal shortlist. This repository contains all three Level 2 tasks.

| Task | Implementation |
| --- | --- |
| 1. Single Page Application | Home/Search, About, Contact and Saved routes using React Router; favorites shared through React Context. |
| 2. REST API integration | Fetch from GitHub's public user-search API, 400 ms debounce, cancellation and stale-response protection, loading/empty/error/offline/rate-limit states and retry. |
| 3. CSS framework | Bootstrap grid and form styles, customized colors, typography, spacing, focus styles and responsive navigation. |

## Run locally

Requires Node.js 24.15 or newer and npm.

```sh
git clone https://github.com/tejaspant09/codveda-level-2-intermediate.git
cd codveda-level-2-intermediate
npm ci
npm run dev
```

Open http://127.0.0.1:5175/. This standalone app uses `/`, `/saved`, `/about` and `/contact` directly.

```sh
npm test
npm run build
npm run preview
```

The production preview runs at http://127.0.0.1:4175/. Build output is written to `dist/`.

## Try the app

1. Search for `octocat` or a qualifier such as `location:bangalore`.
2. Save a profile, open Saved, refresh, and remove it.
3. Navigate to About and Contact without reloading the page.
4. Submit the Contact form with empty fields, then valid example values.
5. At a phone width, use Menu to open navigation.

The Contact form validates input locally and does not send email. Saved profiles remain in the current browser when local storage is available, with a limit of 100. No GitHub credentials are needed. GitHub controls API availability and request limits.

## Code guide

- `src/main.jsx`: React entry point, router and stylesheet imports.
- `src/App.jsx`: page components, API requests, shared favorites, storage and validation.
- `src/styles.css`: Bootstrap customizations and responsive layout.
- `shared/`: bundled fonts and reusable styles.
- `tests/`: component tests covering API states, routing, favorites and validation. Network responses are mocked in these tests.
- `docs/VERIFICATION.md`: checks performed on this standalone repository.

## Hosting

Deploy `dist/` at the root of a domain after `npm run build`. Configure the host to return `index.html` for client routes such as `/saved` and `/contact`. Netlify configuration and a fallback rule are included. Other hosts need equivalent settings; GitHub project Pages requires additional base-path and routing setup.

The existing [shared internship preview](https://codveda-frontend-lab-tejas.tejaspant14.chatgpt.site/level-2/) uses `/level-2/` and currently requires the owner's sign-in. This repository has its own build and has not been deployed as a separate website.

## Project provenance

Extracted from [the original internship repository](https://github.com/tejaspant09/codveda-frontend-lab-2026), source commit `d1e1112605c74473a70a1370807fb8568a99537c`. Imports, router base and navigation were adjusted so it runs independently.

Prepared with AI assistance. Review, understand and personalize the code, and follow Codveda's originality rules when presenting your contribution. Internship dates: 21 November–21 December 2026.

Application source is under the MIT License. See `LICENSE` and `THIRD-PARTY-NOTICES.md`.
