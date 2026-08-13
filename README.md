# TarkovGuides

Community guides, trackers, and tools for [Escape from Tarkov](https://www.escapefromtarkov.com/), built with Next.js and TypeScript.

**Live site:** [tarkovguides.com](https://www.tarkovguides.com)

## What's here

- **Progress Tracker** (`/progress-tracker`): quest tracking (list, tree, trader, and analytics views), stash item tracking with flea market tax math, Kappa/Collector progress, hideout upgrade planning, multi-profile support, and backup/restore.
- **Maps** (`/maps`): interactive map viewer with live quest markers, freehand annotations, boss spawn info, a live in-game clock, and collaborative sessions you can share with a group.
- **PvP Guide** (`/pvp-guide`): a tiered series of PvP fundamentals guides.
- **Master Tarkov Companion**: an optional local app that reads your game logs and syncs live state (position, raid status) into the site.
- FAQ, External Resources, and a home page rounding things out.

Game data comes live from [tarkov.dev](https://tarkov.dev/)'s public API. Full write-up of how everything fits together is in the [docs site](./docs-site).

## Getting started

```bash
npm install
npm run dev       # http://localhost:3000
```

`npm install` also sets up the git hooks (linting, formatting, and commit message checks run automatically before each commit).

See [`docs-site`](./docs-site) for the full documentation: setup, architecture, conventions, testing, and a per-file code reference. Run it locally with:

```bash
cd docs-site
npm install
npm run dev        # http://localhost:3000 (docs site uses its own port when run alongside the main app)
```

## Scripts

| Script              | Purpose                           |
| ------------------- | --------------------------------- |
| `npm run dev`       | Start the dev server              |
| `npm run build`     | Production build                  |
| `npm run lint`      | ESLint                            |
| `npm run typecheck` | TypeScript, no emit               |
| `npm test`          | Unit and component tests (Vitest) |
| `npm run test:e2e`  | End-to-end tests (Playwright)     |

## License

The project's own code is MIT licensed, see [LICENSE](./LICENSE). Map imagery in `public/maps/` is third-party and comes with its own, more restrictive licensing (some of it noncommercial-only). See [`public/maps/SOURCES.md`](./public/maps/SOURCES.md) for the full breakdown and required attribution before reusing or redistributing anything from that folder.
