# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Home Assistant Lovelace custom card for controlling robot vacuum cleaners. Built with Lit 3 web components and TypeScript, bundled with Rollup.

## Commands

- `npm start` — dev server with watch mode at localhost:5000
- `npm run build` — production build to `dist/vacuum-card.js`
- `npm run lint` — ESLint on `src/`
- `npm run lint:fix` — ESLint with auto-fix
- `npm run format` — Prettier (single quotes enabled)
- `npm test` — runs lint + build (no unit tests)

## Architecture

Single custom element `<vacuum-card>` registered via Lit's `@customElement` decorator.

- **`src/vacuum-card.ts`** — Main `VacuumCard` LitElement. Renders sub-sections (toolbar, stats, map, battery, source, name, status) via separate `render*()` methods. Calls Home Assistant services through `hass.callService()`.
- **`src/editor.ts`** — `VacuumCardEditor` implementing `LovelaceCardEditor` for the visual config UI.
- **`src/config.ts`** — `buildConfig()` validates entity and applies defaults for all optional fields.
- **`src/types.ts`** — TypeScript interfaces (`VacuumCardConfig`, `VacuumEntity`, `VacuumCardAction`, `VacuumCardShortcut`, `VacuumCardStat`).
- **`src/localize.ts`** — i18n with 28 languages. Detects language from `localStorage` or `navigator`, falls back to English.
- **`src/translations/`** — JSON translation files keyed by language code.
- **`src/styles.css`** — Main card styles, processed by PostCSS with `postcss-preset-env` and converted to Lit CSS via `rollup-plugin-postcss-lit`.

## Build Pipeline

Rollup entry: `src/vacuum-card.ts` → output: `dist/vacuum-card.js` (ES module). Key transforms: TypeScript → Babel (ES2017 target) → PostCSS (nested rules → Lit CSS) → Terser (prod only). Uses `experimental decorators` in tsconfig.

## Home Assistant Integration

- `custom-card-helpers` for Lovelace card/editor interfaces
- `home-assistant-js-websocket` for HA type definitions
- `ha-template` for Jinja2 template rendering in attributes
- Entity state accessed via `this.hass.states[entityId]`
- Services called via `this.hass.callService(domain, service, data)`

## i18n

To add a translation: create `src/translations/{lang}.json`, import it in `src/localize.ts`, and add it to the `languages` record. Translation strings use `{placeholder}` syntax for interpolation.
