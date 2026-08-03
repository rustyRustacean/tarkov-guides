# Privacy

A plain-language privacy policy reflecting what this site's code actually does: no accounts, no
analytics, no ad trackers, no tracking cookies. Progress Tracker data, theme choice, and
device-sync pairing settings all live in the browser's own `localStorage`/IndexedDB by default.
The one place data leaves a single browser is Liveblocks - used for Maps "Collaborate" sessions
(`maps/session/liveblocks-config.tsx`) and cross-device Progress Tracker sync
(`companion/use-device-sync.ts`) - and only while a session/sync is actively turned on.

Written from the site's actual data flows (checked 2026-08-03: no `gtag`/GA/Plausible/PostHog/
Sentry-style snippets anywhere in `src`), not generic boilerplate - re-verify against the code
before relying on this description if a new feature starts moving data off the browser (a new
third-party integration, an account system, ads, etc.).

Unlike the other `src/features/*` folders, this isn't a migration phase target - there's no legacy
equivalent in either `old/TarkovTrackerWB-main` or `old/tarkov-tips`. New content, same category as
`credits`/`faq`/`external-resources`.

**Status:** COMPLETE - implemented and live at `/privacy`, linked from the footer as "Privacy"
(`Footer.tsx`, between "Credits" and "Contact us"). Covered by `PrivacyPage.test.tsx`.
