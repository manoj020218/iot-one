# Play Console release assets — Jenix One

Generated 2026-09-14 from the actual app build (`app-release.aab` /
`app-release.apk`, signed with the real upload key — see
`../RELEASE_SIGNING.md`). Everything in this folder is a draft for you to
review before submitting; nothing has been uploaded to Play Console yet.

## Contents

- `hi-res-icon-512.png` — 512×512 store icon, downscaled from the app's own
  master icon (`../resources/icon.png`), no changes.
- `feature-graphic-1024x500.png` — generated store feature graphic, ink-navy
  brand background matching the app's own palette (`web-pwa/src/styles.css`
  `--ink`), the real app logo, and the tagline "One app for every Jenix
  smart device."
- `screenshots/01-device-catalog.jpg`, `02-ap-mode-provisioning.jpg` — real
  screenshots of the actual running app (Device Management catalog showing
  all 9 supported products, and the redesigned AP-mode pairing flow), not
  mockups. Only 2 screenshots — Play requires a minimum of 2 per form
  factor; add more once you have a phone with real device data to show a
  populated Home screen (the dev/test account used here has no devices
  bound to it, so Home renders empty).
- `store-listing.md` — app name, short/full description, category
  suggestion, and this version's "what's new" release notes.
- `data-safety-notes.md` — draft answers for the Data Safety form, grounded
  in the actual declared permissions and a dependency scan (no ads/
  analytics SDKs found) — **read the caveats in that file**, some answers
  depend on backend behavior I couldn't audit from here.
- `content-rating-notes.md` — guidance for the in-console IARC
  questionnaire (can't be filled in outside the console).
- `../RELEASE_SIGNING.md` — signing key location/fingerprint (already
  existed, not new).

## Not included, and why

- **No promo video** — optional in Play Console, skipped rather than
  fabricated.
- **No tablet/Chromebook screenshots** — optional; add later if you want
  those listings.
- **Privacy policy page itself** — already live at
  `https://one.jenix.in/privacy` (verified HTTP 200 on 2026-09-14), so
  nothing to draft here beyond pointing Play Console at that URL.

## What I did not do

I have not clicked "Publish," "Submit for review," or created/edited
anything inside Play Console itself. Play's compliance questionnaires
(Data Safety, Content Rating, target audience, ads declaration) are
attestations under your developer account — I drafted honest answers based
on what the code actually does, but you should read and confirm each one
before submitting, not treat this folder as pre-approved.
