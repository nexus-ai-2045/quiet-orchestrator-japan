# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Durable product decisions

- The primary horizon is 2026–2045. “終末の1ヶ月” is a 30-day, 6-hour-step nested stress test, not the main simulation.
- The final success condition is that the coordination network still functions when Japan leaves the center.
- The visual source of truth is the selected dark-indigo 2026–2045 hybrid mock generated on 2026-08-24.
- The simulation is deterministic and local-only. Do not add live attribution, external API calls, or model-generated policy decisions without a separate ADR and review.
