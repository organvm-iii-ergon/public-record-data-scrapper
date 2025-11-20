---
description: AI rules derived by SpecStory from the project AI interaction history
globs: *
---

## Architecture & Data Flow
- `src/App.tsx` orchestrates every dashboard tab, wiring `StatsOverview`, `AdvancedFilters`, and `AgenticDashboard`; it stores view-state with `useKV`, so new features must keep those KV keys stable.
- First-run data comes from `src/lib/mockData.ts` and gets persisted via `useKV`; generators expect the shapes in `src/lib/types.ts`, so extend types before touching the factories.
- Prospect filtering happens inside the `filteredAndSortedProspects` memo in `App.tsx`; emissions like `trackAction('filter', …)` feed the agentic analytics, so route new user events through `trackAction`.
- Batch operations rely on syncing `selectedProspectIds` with `BatchOperations` and the checkbox overlay in `ProspectCard`; keep that contract intact when adding bulk actions.

## Agentic System
- `src/lib/agentic/AgenticEngine.ts` runs the autonomous loop (`runAutonomousCycle`) and enforces safety gates like `autonomousExecutionEnabled` and category-based review; leave those guards in place when expanding automation.
- `AgenticCouncil` sequences `DataAnalyzerAgent → OptimizerAgent → SecurityAgent → UXEnhancerAgent`; each agent returns findings that get wrapped as improvements, so new agents should extend `BaseAgent` and push their suggestions into the handoff.
- The React bridge lives in `src/hooks/use-agentic-engine.ts`; it caches the engine instance, persists improvements via `useKV`, and drives `AgenticDashboard`. Always call `setImprovements(engine.getImprovements())` after mutating engine state.
- Vitest expectations in `src/lib/agentic/AgenticEngine.test.ts` assert safety thresholds, feedback loops, and manual approval flows; update or add tests there when changing agent logic.

## UI & Styling
- UI primitives under `src/components/ui/` follow the ShadCN pattern with Tailwind; reuse those wrappers instead of raw Radix imports and keep the custom `glass-effect` utility classes from `src/main.css`.
- Global theming is driven by CSS variables in `styles/theme.css` and `theme.json`, with Tailwind tokens wired up in `tailwind.config.js`; new tokens should land in `theme.json` first.
- Icon imports go through `@phosphor-icons/react` and are proxied by `createIconImportProxy` in `vite.config.ts`; do not remove that plugin or the `@github/spark` Vite plugin.
- Theme switching uses `ThemeToggle` and `ThemeProvider` (`next-themes`); ensure any new layout components respect the `data-appearance` selector for dark mode.

## Data & Utilities
- `src/lib/types.ts` is the canonical source for prospect, signal, and agentic shapes; update it (and matching fixtures/tests) before introducing new fields in UI components.
- `src/lib/mlScoring.ts` augments prospects with predictive metrics; keep helper functions pure so unit tests can stub deterministic inputs.
- `src/lib/exportUtils.ts` handles JSON/CSV exports with `escapeCsvValue`; reuse that helper for any additional export formats to preserve quoting rules.
- Email notes, reminders, and outreach flows share IDs generated through `generateId` in `App.tsx`; keep ID formats consistent for KV persistence.

## Developer Workflow
- Install and run locally with `npm install`, then `npm run dev` (Vite defaults to port 5000); kill the port via `npm run kill` before restarting if it hangs.
- Build with `npm run build` (`tsc -b --noCheck` + Vite build); rely on IDE type checking because the build skips diagnostics.
- Test with `npm test`; use `npm test -- AgenticEngine` for focused runs and `npm test:coverage` when adjusting agent logic or data exports.
- Lint with `npm run lint`; Vitest uses `jsdom` with globals configured in `src/test/setup.ts`, so add DOM helpers there when tests need extra utilities.

## Git Notes
- Follow the consolidation flow in `docs/archive/BRANCH_CONSOLIDATION.md`: merge sibling branches into the working branch before opening PRs, resolve conflicts locally, then push.
- When flattening PRs, keep unique work and mark unresolved suggestions as TODOs rather than deleting peer comments.
- Always stage only the files you touched; if unexpected changes appear, clarify with the requester before proceeding.

## Known Issues
- VS Code may show “Element with id Copilot on My Behalf... is already registered”; it is harmless and clears after restarting or updating extensions.