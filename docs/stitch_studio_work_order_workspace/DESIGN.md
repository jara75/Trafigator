---
name: Studio Obsidian
colors:
  surface: '#121316'
  surface-dim: '#121316'
  surface-bright: '#38393c'
  surface-container-lowest: '#0d0e11'
  surface-container-low: '#1b1b1f'
  surface-container: '#1f1f23'
  surface-container-high: '#292a2d'
  surface-container-highest: '#343538'
  on-surface: '#e3e2e6'
  on-surface-variant: '#bdc8d1'
  inverse-surface: '#e3e2e6'
  inverse-on-surface: '#303034'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#8ed5ff'
  on-primary: '#00354a'
  primary-container: '#38bdf8'
  on-primary-container: '#004965'
  inverse-primary: '#00668a'
  secondary: '#c3c0ff'
  on-secondary: '#1d00a5'
  secondary-container: '#3626ce'
  on-secondary-container: '#b3b1ff'
  tertiary: '#56e5a9'
  on-tertiary: '#003824'
  tertiary-container: '#30c88f'
  on-tertiary-container: '#004e34'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c4e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#121316'
  on-background: '#e3e2e6'
  surface-variant: '#343538'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: -0.01em
  body-default:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: -0.005em
  body-medium:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.005em
  label-regular:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.01em
  label-compact:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 12px
    letterSpacing: 0.03em
  code-timecode:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.02em
  code-param:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
  code-shortcut:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 0.5rem
  gutter-dense: 0.25rem
  margin: 0.5rem
  space-xs: 0.125rem
  space-sm: 0.25rem
  space-md: 0.5rem
  space-lg: 0.75rem
  space-xl: 1rem
---

## Brand & Style

This design system is engineered for elite digital craftspeople, technical artists, audio/video editors, and systems operators requiring sustained visual focus over multi-hour working sessions. It merges the surgical density and ergonomic dark workspaces of pro production software like DaVinci Resolve with the meticulous micro-typography, precise interaction feedback, and keyboard-first velocity of modern developer suites.

The visual style is **High-Density Technical Precision**:
- High screen efficiency with low decorative noise; UI frames the workspace canvas without demanding attention.
- Deep, low-fatigue slate backgrounds punctuated by razor-sharp hairline dividers and high-contrast electric telemetry accents.
- Utilitarian luxury: Every pixel, border, and badge serves an immediate operational purpose, prioritizing glanceability, spatial muscle memory, and instantaneous key-bound workflows.

## Colors

The palette is engineered specifically for deep-focus OLED and low-reflection HDR displays, maintaining ultra-low eye strain while guaranteeing crisp boundary delineation across stacked docking panels.

### Surface Tones & Neutrals
- **Canvas Base (`#0e0f12`)**: The foundational canvas beneath timelines, node graphs, and monitors.
- **Surface Dock / Panel (`#15171c`)**: Primary structural panels, side inspectors, tool headers, and docks.
- **Surface Elevated / Flyout (`#1c1f26`)**: Context menus, quick-switch command bars, modal popovers, and inspector groups.
- **Hairline Border (`#232730`)**: Ultra-subtle border separating panels and dense tool arrays.
- **Border Active / Focus (`#343b48`)**: High-contrast interactive perimeter indicating focus rings and active inspector sections.

### Accents & Electrical Signals
- **Electric Cyan (`#38bdf8`)**: Primary action, scrub heads, active timeline cursors, active node paths, and selected micro-chips.
- **Studio Indigo (`#4f46e5`)**: Primary key buttons, focus indicators, multi-selection bounding boxes, and pipeline badges.

### Status Badges & Telemetry
- **Telemetry Emerald (`#10b981`)**: Render success, synced state, online proxies, master outputs.
- **Telemetry Amber (`#f59e0b`)**: Scrubbing cache warnings, frame drops, non-blocking conflicts.
- **Telemetry Rose (`#f43f5e`)**: Missing media, compilation errors, critical overloads, locked track indicators.
- **Telemetry Purple (`#a855f7`)**: Special automation tracks, meta-tags, script nodes, and auxiliary buses.

## Typography

Typography prioritizes information density, micro-legibility, and tabular alignment. Headlines are restrained and compact, avoiding oversized display scales to preserve maximum workspace geometry for core functional views.

- **Primary UI (Inter)**: Tuned for tiny 10px–13px rendering with strict tracking adjustments. High x-height ensures crisp legibility on non-Retina and high-refresh studio monitors.
- **Technical Readouts & Values (JetBrains Mono)**: Employed for all numerical properties, timeline counters (`01:24:18:12`), frame metrics, keyboard shortcut glyphs (`⌘K`, `⇧D`), scrub scrubbing coefficients, and inline hex/matrix values. Tabular numerals ensure zero spatial jitter during real-time value scrubbing.

## Layout & Spacing

Layout operates on an uncompromising 4px spatial baseline engineered for dense multi-panel docking, resizable split-views, and collapsible side inspectors.

### Layout Mechanics
- **Multi-Pane Docking Matrix**: The viewport uses a fluid pane framework separated by 1px drag-handles (represented spatially with `gutter-dense`). Panels can split vertically or horizontally with zero dead canvas space.
- **Compact Padding**: Inner toolbar and inspector padding strictly uses `space-sm` (4px) and `space-md` (8px). Gaps between discrete controls within a group never exceed `space-xs` (2px) or `space-sm` (4px).
- **Responsive Adaptations**:
  - **Desktop (>= 1440px)**: Persistent multi-inspector panels (left media/node tree, center viewport/timeline, right parameter matrix).
  - **Laptop / Compact Workstations (1024px - 1439px)**: Collapsible sidebar trays, single primary inspector with tabbed sub-decks.
  - **Tablets / Mobile (< 1024px)**: Stacked single-pane workflows with floating sheet inspectors and full-width touch scrub strips.

## Elevation & Depth

This design system avoids traditional fuzzy drop shadows and diffuse elevation blurs, maintaining sharp optical boundaries across low-light workrooms.

- **Tonal Stepping**: Depth is conveyed via structural background values: Canvas (`#0e0f12`) sits furthest back, Panel Surfaces (`#15171c`) form the working ground, and Tool Strips/Headers (`#181a20`) define the immediate interaction plane.
- **Hairline Precision**: Panels and containers are separated by crisp 1px solid borders (`#232730`). Visual separation never relies on gradient skeuomorphism.
- **Floating Overlays & Command Bars**: Overlays, popout color wheels, and Command+K modals use `#1c1f26` elevated backgrounds framed with an outer hairline stroke (`#343b48`) and an ultra-subtle directional rim: `0 4px 16px rgba(0, 0, 0, 0.65)`.
- **Active Focus Layering**: Active panes, focused input cells, or scrubbing sliders receive a razor-thin internal or external 1px boundary stroke of Electric Cyan (`#38bdf8`) or Indigo (`#4f46e5`).

## Shapes

The shape system adopts a tight, engineered radius profile (`roundedness: 1`). Soft 4px (`0.25rem`) corners soften individual interactive inputs without compromising the visual discipline of the grid.

- **Panels & Docking Frames**: 0px radius at workspace intersections; outer application framing remains cleanly squared.
- **Inputs, Buttons, & Tool Icons**: Standard `rounded-sm` (2px) to `rounded` (4px) corner radii, preserving tight grouping density without overlapping contours.
- **Status Tags & Badges**: 2px border radius for rectangular telemetry tags; 9999px (pill-shaped) exclusively reserved for circular online/sync connection dots and scrubber playheads.

## Components

### Buttons & Tool Controls
- **Ghost/Icon Action Buttons**: 24px × 24px and 28px × 28px square footprints. Transparent background with high-contrast monochrome icons (`#94a3b8`). On hover: `#1e222b` background with `#f8fafc` icon tint. On active/pressed: `#272c38`.
- **Primary Studio Action**: Height 26px, padding 0 10px. Filled `#4f46e5` with crisp white text (`Inter 11px 500`). Hover transitions to `#4338ca`. Focused state reveals a 1px offset ring in `#38bdf8`.

### Compact Value Scrubber Inputs & Text Inputs
- **Scrub Fields**: Height 22px. Dark inset background (`#111317`) framed by 1px hairline border (`#232730`). Monospaced value (`JetBrains Mono 11px`) aligned right, parameter prefix label (`Inter 10px`) in muted slate (`#64748b`) aligned left. Drag-scrubbing activates a 1px Electric Cyan bottom-border progress indicator.
- **Text Inputs**: Height 24px, 6px horizontal padding. Monospaced or sans text with an instantaneous `#38bdf8` perimeter glow upon active focus.

### Telemetry Badges & Status Chips
- Height 18px, padding 0 6px, border-radius 2px.
- Minimalist tinted background (12% opacity) paired with solid text and matching 1px border at 25% opacity:
  - **Success / Sync**: `#10b981` (Emerald)
  - **Warning / Frame Drop**: `#f59e0b` (Amber)
  - **Error / Offline Asset**: `#f43f5e` (Rose)
  - **Track / Node Automation**: `#a855f7` (Purple)

### Timecode Counters & Readouts
- Embedded in a dedicated readout chassis (`#111318`).
- Monospaced 12px tabular numerals with micro-letter-spacing (`-0.02em`).
- Non-active frame segments render in muted slate (`#475569`), active or scrubbed units illuminate in solid Electric Cyan (`#38bdf8`) or crisp white (`#f8fafc`).

### Checkboxes, Switches & Radio Toggles
- **Checkboxes**: 14px × 14px box, 2px corner radius, hairline border `#343b48`. Checked state fills `#4f46e5` with a 1px white checkmark icon.
- **Micro-Switches**: 24px width × 13px height. Flat track background `#1e222b`, sliding pip 9px × 9px white square with 1px radius. Checked state track transitions to `#38bdf8`.

### Lists, Tree Inspectors & Node Cards
- **Inspector Rows**: Dense 22px fixed row height with 4px indentation increments per hierarchical depth level. Hover generates `#191c23` background fill across the entire row width.
- **Node Cards**: Dockable cards with 1px border `#232730`, 18px title bar containing module status dot, input/output connection pins (6px diameter circles positioned along left/right borders), and compact embedded parameter scrubbers.