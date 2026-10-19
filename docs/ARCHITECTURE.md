# Architecture

FireworX Studio is a standalone edition of MIDI Studio, not a second MIDI implementation. The entry point selects one registered editor; the host provides shared browser services.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Entry/build | `src/main.tsx`, `vite.config.mts`, `build/` | One-editor selection, relative assets, CSP and offline cache |
| Host | `src/editor-host/` | Installation, lifecycle, MIDI access/broker, leases, permissions, history and shared presentation |
| Shared services | `src/i18n.tsx`, `src/themes.ts`, `src/library/` | Language, host theme, local file library |
| FireworX adapter | `src/editors/fireworx/registration.tsx`, `session.ts`, `browser-environment.ts` | Editor contracts and host integration |
| FireworX UI | `src/editors/fireworx/page/`, `view.tsx`, `manual.css` | Facades, matrix, settings, librarian and illustrated manual |
| Device engine | `src/editors/fireworx/engine/` | Preset codec, graph, modulation, variation planner and protected transport |
| Data | `src/editors/fireworx/data/` | Mapping tables, algorithm definitions and naming vocabulary |

The module uses injected services rather than opening an independent physical MIDI sender. The broker authorizes operations; the FireworX transport additionally validates frames, reference state, serialization and readback. An import, recovered browser state or local variation does not grant write authority. P0 editing and persistent STORE remain separate operations.

## Variations

Randomization uses a seeded draw over compatible groups and decoded presets available in the current local corpus. Parameter variation protects modulated/opaque groups. Structure variation changes permitted placement. Blocks + routing varies algorithms and engine count within instance quotas, connectivity rules and the estimated resource ceiling. Protected feedback/Insert paths remain constrained. The proposal is previewed before applying locally or to temporary P0; there is no background hardware send merely from generating a preview.

The additive DSP model is deliberately an estimate. Its configurable ceiling is shared with manual placement, and the 100–108% tolerance remains visibly flagged. It does not establish measured processor use or audio safety. Reimplementations should retain deterministic seeds, explicit locks, eligibility checks, proposal validation and a separate application transaction.

## Persistence and manuals

LocalStorage/IndexedDB hold browser state. Exports are portable files; they are not remote backups. Storage is scoped to the origin, not isolated by each URL path. Different projects hosted on the same origin may share browser storage and coordination boundaries.

The EN/FR Markdown manuals and screenshots are compiled into the editor by `scripts/generate-fireworx-manual.mjs`. The generator's check runs before building. The manual export embeds images for offline reading; no external image host is required.

## Validation boundary

`npm test` runs seven offline suites for module lifecycle, byte preservation, graph operations, guarded transport, panel controls/indicators, recall and complete-image structural transactions. It uses generated data and fake ports. It is not physical qualification. The distribution verifier checks that only the selected editor implementation is bundled. CI checks source and compiled artifacts before deployment.

This repository is a clean standalone source snapshot. Future shared-platform changes should preserve these contracts and rerun the offline checks; changes here do not automatically update the upstream workspace.
