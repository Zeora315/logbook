---
name: Zeora Logbook
description: A simple three-column changelog room for publishing as Zeora or 虾米.
colors:
  bg: "#f4f5f4"
  surface: "#ffffff"
  surface-short: "#fff"
  surface-soft: "#f0f1f2"
  surface-tint: "#f8f8f7"
  keycap: "#f7f7f8"
  visual-soft: "#f1f4f7"
  ink: "#202124"
  ink-strong: "#0f1115"
  body-muted: "#5a626c"
  body-ink: "#3d444d"
  muted: "#6f767f"
  faint: "#a5abb3"
  line: "#e4e7eb"
  line-strong: "#d6dae0"
  focus-line: "#b8d0e5"
  active-line: "#bdd2e5"
  zeora: "#4b8fbf"
  xiami: "#ee8f43"
  accent: "#2f73a8"
  accent-soft: "#e8f1f8"
  neutral-dot: "#8b95a1"
  ok: "#4f9e66"
  ok-wash: "#e9f8ed"
  danger: "#d15b49"
  danger-wash: "#fff0ed"
  warn-wash: "#fff5d7"
  warn-text: "#916814"
  logo-wash: "#dfefff"
  topbar-wash: "rgba(245, 246, 247, 0.9)"
  panel-wash: "rgba(255, 255, 255, 0.92)"
  stage-wash: "rgba(255,255,255,0.96)"
  stage-tint: "rgba(245,248,251,0.92)"
  highlight-dot: "rgba(255, 255, 255, 0.9)"
  accent-shadow: "rgba(47, 115, 168, 0.16)"
  shadow-low: "rgba(15, 17, 21, 0.06)"
  shadow-faint: "rgba(15, 17, 21, 0.04)"
  shadow-soft: "rgba(15, 17, 21, 0.08)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.55rem, 2.3vw, 2.2rem)"
    fontWeight: 800
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.45rem, 2.4vw, 2.1rem)"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  card-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(1.2rem, 1.7vw, 1.58rem)"
    fontWeight: 800
    lineHeight: 1.22
    letterSpacing: "-0.02em"
  panel-title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.28rem"
    fontWeight: 800
    lineHeight: 1.15
  readout:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1.12rem"
    fontWeight: 900
    lineHeight: 1.2
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  intro:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.96rem"
    fontWeight: 400
    lineHeight: 1.65
  control:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 760
    lineHeight: 1.25
  nav:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.92rem"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.82rem"
    fontWeight: 750
    lineHeight: 1.2
  micro:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.72rem"
    fontWeight: 800
    lineHeight: 1.2
  chip:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 800
    lineHeight: 1.2
  keycap:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: "0.74rem"
    fontWeight: 700
    lineHeight: 1.1
  preview-date:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 750
    lineHeight: 1.2
rounded:
  code: "5px"
  kbd: "7px"
  sm: "8px"
  md: "14px"
  lg: "16px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.ink-strong}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
---

# Design System: Zeora Logbook

## Overview

**Creative North Star: "Clean Memo Room"**

The interface is a quiet three-column log room: identity and navigation on the left, update stream in the center, static tag context and totals on the right. It borrows the calm density of the reference pages without inheriting their visual noise.

The system is light, rounded, and compact. Cards are white with thin gray borders, author identity is shown through small color signals, and controls stay familiar enough that publishing feels like filling out a memo rather than operating a heavy dashboard.

**Key Characteristics:**

- Three visible zones: navigation, log stream, and context panel.
- White and soft gray surfaces instead of dramatic dark panels.
- Author color appears as a small signal, not a full theme.
- Memo cards support quick scanning with title, summary, body, tags, and no cover panel.

## Colors

The palette is neutral-first: white panels, misty gray page background, blue interaction accents, and warm orange for 虾米.

### Primary

- **Zeora Blue** (#4b8fbf): Zeora author signal.
- **虾米 Orange** (#ee8f43): 虾米 author signal.
- **Interaction Blue** (#2f73a8): focus, active controls, and secondary actions.

### Neutral

- **Page Gray** (#f4f5f4): full-page background.
- **Surface White** (#ffffff / #fff): cards, fields, panels, and buttons.
- **Soft Surface** (#f0f1f2): selected nav items and secondary wells.
- **Tint Surface** (#f8f8f7): form fields and queue rows.
- **Ink** (#202124) and **Strong Ink** (#0f1115): body and headings.
- **Muted Gray** (#6f767f) and **Faint Gray** (#a5abb3): secondary text and keyboard hints.
- **Line Gray** (#e4e7eb) and **Strong Line** (#d6dae0): dividers and card borders.

### State Colors

- **Accent Soft** (#e8f1f8): active controls and selected identity controls.
- **OK Wash** (#e9f8ed): saved state.
- **Warn Wash** (#fff5d7): saving or unsaved state.
- **Danger Wash** (#fff0ed): error state.

## Typography

**Display Font:** system sans stack.
**Body Font:** system sans stack.
**Label/Mono Font:** system monospace stack.

**Character:** Typography is compact and UI-native. Headings are bold and slightly tight; metadata is small but readable; long body text keeps a comfortable 65-70ch measure.

### Hierarchy

- **Display** (800, clamp(1.55rem, 2.3vw, 2.2rem), 1.06): left identity title.
- **Headline** (800, clamp(1.45rem, 2.4vw, 2.1rem), 1.12): page section headings.
- **Card Title** (800, clamp(1.2rem, 1.7vw, 1.58rem), 1.22): log card titles.
- **Panel Title** (800, 1.28rem, 1.15): admin panel headings.
- **Body** (400, 1rem, 1.65): summaries and post bodies.
- **Control** (760, 0.9rem, 1.25): labels and form captions.
- **Chip** (800, 0.78rem, 1.2): author, tag, and status pills.
- **Micro** (800, 0.72rem, 1.2): small uppercase labels.

## Layout

The public page uses three desktop columns: `260px / fluid / 260px` with generous gutters. The left rail is sticky and holds brand, intro, and navigation. The center stream holds text-only update cards. The right rail is sticky and holds static tags plus total published count.

On mobile, the log stream remains the primary surface and both side rails move into a right-side drawer opened by a single bottom-right button.

The admin page remains three-column: queue, editor, preview. It now uses the same light card system as the public page.

## Elevation & Depth

Depth is subtle. Cards use one thin border plus a low, soft shadow. Hover states lift slightly, but the interface should still feel like a clean document workspace.

### Shadow Vocabulary

- **Card Shadow** (`0 1px 2px rgba(15, 17, 21, 0.06), 0 10px 30px rgba(15, 17, 21, 0.06)`): standard cards and rails.
- **Soft Shadow** (`0 1px 2px rgba(15, 17, 21, 0.04), 0 16px 44px rgba(15, 17, 21, 0.08)`): reserved for future overlays.

## Shapes

Corners are friendly but not bubbly: 8px controls, 14px fields and rows, 16px major panels, 999px only for chips and dots. Inline code uses 5px and keyboard hints use 7px.

## Components

### Buttons

- **Shape:** compact 8px rectangle.
- **Primary:** strong ink fill with white text.
- **Secondary:** blue fill with white text.
- **Ghost:** white surface with gray border, blue/gray hover.

### Chips

- **Style:** small rounded pills with optional signal dot.
- **State:** selected controls use blue-tinted background and blue text.

### Cards / Containers

- **Corner Style:** 16px for rails and main cards.
- **Background:** white or lightly translucent white.
- **Shadow Strategy:** low card shadow plus one-pixel border.
- **Internal Padding:** 16-22px depending on density.

### Inputs / Fields

- **Style:** soft tinted background with gray border.
- **Focus:** white background and pale blue border.
- **Error / Disabled:** explicit state text with danger/warn washes.

### Navigation

Left navigation uses stacked rows with bold text. Active rows use soft gray fill and a small trailing dot.

## Do's and Don'ts

- Do keep the three columns visible on desktop.
- Do use author colors only as small signals.
- Do keep body text black/gray and highly readable.
- Don't return to the dark cockpit style.
- Don't turn the page into a marketing landing page.
- Don't add decorative charts or fake metrics.
