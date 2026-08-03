# Credits

A single page attributing every third-party source this site pulls live data or bundled assets
from: tarkov.dev (game data + JPG/tile map imagery), the-hideout/tarkov-dev-svg-maps (SVG overview
maps), the Escape from Tarkov Wiki on Fandom (live quest guide text/screenshots), re3mr/reemr.se
(the Ice Breaker deck plan image), and TarkovBOT.eu (Ice Breaker tile imagery, credited via
tarkov.dev's own map metadata).

Two of these sources are CC BY-NC-SA (the SVG maps and the reemr.se deck plan) - noncommercial use
only, and the reason this page exists rather than a passing footer mention: that license requires
attribution wherever the work is used. Content licenses (as opposed to source-code licenses like
the MIT/GPLv3 ones on tarkov.dev's own repos) were confirmed against each source's own copyrights
page/repo LICENSE file on 2026-08-02 - re-verify before relying on this for anything beyond "the
site gives credit," since license terms/URLs can change upstream without this page knowing.

Unlike the other `src/features/*` folders, this isn't a migration phase target - there's no legacy
equivalent in either `old/TarkovTrackerWB-main` or `old/tarkov-tips`. It's new content, same
category as `faq`/`external-resources`.

**Status:** COMPLETE - implemented and live at `/credits`, linked from the footer as "Credits"
(`Footer.tsx`, next to `ContactLink`). Covered by `CreditsPage.test.tsx`.
