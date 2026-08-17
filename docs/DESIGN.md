---
name: Stacked
description: A fun, modular sandwich shop where lunch is built like a construction set.
colors:
  punch: "#ff5a2c"
  punch-deep: "#e23f16"
  punch-soft: "#ffe6dc"
  grape: "#7a3ff2"
  grape-deep: "#5e27d0"
  berry: "#ff3d8a"
  zest: "#c6f24e"
  sky: "#34c3e8"
  sun: "#ffc53d"
  counter: "#f8f7f4"
  board: "#efece4"
  char: "#1a1714"
  muted: "#615c54"
  hairline: "#e4dfd5"
  on-punch: "#1a1714"
  on-grape: "#ffffff"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.875rem, 6vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
rounded:
  chip: "10px"
  input: "12px"
  brick: "20px"
  brick-lg: "28px"
  pill: "999px"
spacing:
  unit: "8px"
  2xs: "6px"
  xs: "12px"
  s: "16px"
  m: "24px"
  l: "40px"
  xl: "64px"
  2xl: "96px"
components:
  button-primary:
    backgroundColor: "{colors.punch}"
    textColor: "{colors.on-punch}"
    rounded: "{rounded.brick}"
    padding: "0.7em 1.4em"
  button-primary-hover:
    backgroundColor: "{colors.punch-deep}"
    textColor: "{colors.on-punch}"
    rounded: "{rounded.brick}"
    padding: "0.7em 1.4em"
  button-secondary:
    backgroundColor: "{colors.counter}"
    textColor: "{colors.char}"
    rounded: "{rounded.brick}"
    padding: "0.7em 1.4em"
  ingredient-brick:
    backgroundColor: "{colors.counter}"
    textColor: "{colors.char}"
    rounded: "{rounded.chip}"
    padding: "0.5em 0.9em"
  ingredient-brick-selected:
    backgroundColor: "{colors.zest}"
    textColor: "{colors.char}"
    rounded: "{rounded.chip}"
    padding: "0.5em 0.9em"
  card-brick:
    backgroundColor: "{colors.on-grape}"
    textColor: "{colors.char}"
    rounded: "{rounded.brick}"
    padding: "1rem 1.25rem"
  input-field:
    backgroundColor: "{colors.on-grape}"
    textColor: "{colors.char}"
    rounded: "{rounded.input}"
    padding: "0.65em 0.9em"
---

<!-- Authored at direction-commit (Brick Stack world, user-pinned over the roll; seed key 1af61639).
     Tokens are the committed brand spec; re-run `/impeccable document` after the first real build to
     carbonize them against shipped code. -->

# Design System: Stacked

## Overview

**Creative North Star: "The Sandwich Construction Set"**

Stacked treats lunch like a modular building system. Every ingredient is a brick, every screen is assembled from bricks that stack, snap, and settle, and building your own sandwich is the same tactile joy as clicking parts together. The feeling is a well-made designer construction set — precise, colorful, satisfying to handle — not a children's toy. Confidence and craft keep it on the modern side of playful: a strict modular grid, chunky-but-exact corners, and one loud brand color doing the heavy lifting.

The energy comes from color and motion, not clutter. One hero color (Punch, a tangerine `#ff5a2c`) owns large fields and the primary action; a small palette of ingredient-brick colors appears only where color carries meaning. Depth is literal: bricks rest on a soft two-layer "stack" shadow and physically settle when pressed. Type is built, not decorative — a constructed grotesk for headlines over a friendly workhorse for reading.

This system deliberately rejects the defaults its category pulls toward: the warm-cream-plus-serif "artisanal food" look, the kindergarten primary-only toy-brick palette, chalkboard-deli clichés, and neobrutalist hard zero-blur shadows. Stacked is bright, built, and unmistakably a product.

**Key Characteristics:**
- Modular grid; everything snaps to an 8px brick unit.
- Chunky rounded "brick" forms with one consistent corner family.
- One hero color at page scale; the rest of the palette is earned, not sprinkled.
- Dark ink on bright bricks — the confident, accessible, modern reading.
- Real soft-stack depth with a springy press-settle as the single signature motion.
- Installable PWA, themed to the brand down to the browser chrome.

## Colors

A curated, joyful palette: one loud hero, a set of ingredient-brick accents, and warm neutrals that read as counter paper and char ink rather than cream.

### Primary
- **Punch** (`#ff5a2c`): the hero tangerine. Owns large fields, the primary "Add to cart" / "Place order" action, and the PWA theme color. Paired with dark ink, never white.
- **Punch Deep** (`#e23f16`): pressed and hover state of Punch.

### Secondary
- **Grape** (`#7a3ff2`): build-your-own affordances, links, and the focus ring. The one color that carries white text.
- **Berry** (`#ff3d8a`): loyalty and playful highlights (the studs on a loyalty card).

### Tertiary
- **Zest** (`#c6f24e`), **Sky** (`#34c3e8`), **Sun** (`#ffc53d`): ingredient-brick accents and light-touch states. All are light, so they always take dark ink.

### Neutral
- **Counter** (`#f8f7f4`): the page ground — bright, barely-warm paper.
- **Board** (`#efece4`): section tints and soft surfaces.
- **White** (`#ffffff`): bricks/cards sit a step brighter than the counter so their stack shadow reads.
- **Char** (`#1a1714`): primary ink and the dark surface base.
- **Muted** (`#615c54`): secondary text (≥4.5:1 on Counter).
- **Hairline** (`#e4dfd5`): quiet borders and dividers.

### Named Rules
**The One-Loud-Brick Rule.** Punch owns the big fields and the single primary action on a screen. The rest of the palette appears only as ingredient bricks, selections, and states — a few at a time, never a page-wide rainbow.

**The Dark-Ink-On-Bright Rule.** Every bright brick (Punch, Berry, Zest, Sky, Sun) takes Char ink, not white. It passes contrast (Punch/Char ≈ 6:1) and it is the more modern, more confident reading. Grape is the sole exception that carries white.

## Typography

**Display Font:** Bricolage Grotesque (self-hosted; fallback `system-ui, sans-serif`)
**Body Font:** Hanken Grotesk (self-hosted; fallback `system-ui, sans-serif`)
**Code Font:** JetBrains Mono (code, data, and measurement only)

**Character:** Bricolage Grotesque is a constructed, slightly irregular grotesk — the name means "assembled from what's on hand," which is exactly the brand. Set big, tight, and heavy it feels built, not typeset. Hanken Grotesk is a rounded, friendly workhorse that keeps menus and forms warm and effortless to read.

### Hierarchy
- **Display** (800, `clamp(2.875rem, 6vw, 4rem)`, 1.02, −0.03em): hero headlines and the wordmark moment. One per view.
- **Headline** (700, 2.5rem, 1.12, −0.02em): section titles.
- **Title** (700, 1.5rem, 1.15, −0.01em): brick/card titles, sandwich names.
- **Body** (400, 1.125rem, 1.6): running text; measure 65–75ch.
- **Label** (500, 0.875rem, 1.3, +0.01em): UI labels and prices. Sentence case.

### Named Rules
**The Constructed-Headline Rule.** Bricolage carries every heading; Hanken carries everything read in running text. Never swap them, never add a third display face, never letterspace Bricolage open — it is set tight.

**The No-Eyebrow Rule.** No small tracked label sitting above a heading. The headline carries its own weight.

## Layout

A visible modular grid. Everything snaps to an 8px brick unit (`--brick-unit`) and the spacing scale steps from it (6 / 12 / 16 / 24 / 40 / 64 / 96px). Content is capped at 1200px (`--content-width`) with 24–32px gutters; the top nav is 68px. Density is airy: tight groups inside a brick, generous separation between bricks, and more space above a heading than below it. Bricks reflow and restack down the breakpoints (three-up → two-up → single column) rather than shrinking to fit. Breakpoints follow the project's mobile-first steps at 600 / 900 / 1200px.

## Elevation & Depth

Depth is the point of the world: a brick is a physical object resting on the counter. Every brick uses a two-layer "stack" shadow — a thin near-solid thickness ledge plus a soft diffuse drop — so it reads as dimensional without tipping into a flat neobrutalist block or a decorative colored halo.

### Shadow Vocabulary
- **Stack — resting** (`--shadow-brick`: `0 5px 0 -2px rgb(26 23 20 / .07), 0 14px 26px -10px rgb(26 23 20 / .20)`): default for bricks, cards, and menus.
- **Stack — pressed** (`--shadow-brick-pressed`): the compressed shadow a brick drops to on `:active`, paired with a downward translate.
- **Pop** (`--shadow-pop`): overlays, popovers, and the cart drawer.

### Named Rules
**The Stack-Shadow Rule.** Bricks always rest on the two-layer stack shadow, and pressing settles them (`translateY(3px)` + pressed shadow) over `--duration-snap`. No flat zero-blur block shadows, no zero-offset colored halos.

## Shapes

One chunky corner family gives the brick silhouette: 20px on bricks and cards (`--radius-brick`), 28px on large/hero panels (`--radius-brick-lg`), 10–12px on chips and inputs. Full pills are reserved for genuinely pill-shaped things (tags, the avatar). The signature detail is the **stud** — a small filled circle borrowed from a construction brick — used only to mark connection, selection, and loyalty (a selected ingredient, a filled loyalty slot), never as decoration.

### Named Rules
**The Brick-Radius Rule.** Corners come from the brick family only; a one-off radius is a defect. The stud is a meaning-bearing mark, not an ornament.

## Components

### Buttons
- **Shape:** brick corners (20px), chunky padding (`0.7em 1.4em`), no full pill.
- **Primary:** Punch fill (`#ff5a2c`) with Char ink, resting on the stack shadow; hover deepens to Punch Deep; `:active` translates down 3px into the pressed shadow (the snap-settle). One primary per view.
- **Secondary:** Counter/white fill, Char ink, hairline border, same brick shape and press behavior.
- **Focus:** 2px Grape focus ring, offset from the brick.

### Chips — Ingredient Bricks
- **Style:** small bricks (10px radius) on Counter with a hairline; the ingredient's price sits inline.
- **State:** selected bricks raise onto the stack shadow and show a filled stud + check; multi-select in the builder, single-select for bread. Selected fill uses a light accent (e.g. Zest) with dark ink.

### Cards / Containers — Bricks
- **Corner Style:** 20px (`--radius-brick`).
- **Background:** white, a step brighter than the Counter ground.
- **Shadow Strategy:** the resting stack shadow (see Elevation).
- **Border:** none by default; the shadow does the separating. Hairline only when two white bricks touch.
- **Internal Padding:** `1rem 1.25rem`.

### Inputs / Fields
- **Style:** white fill, 12px radius, hairline border.
- **Focus:** border shifts to Grape with a 2px Grape ring; no glow.
- **Error:** Punch-family border and a short, specific message.

### Navigation
- **Style:** 68px top bar, Counter background, Stacked wordmark in Bricolage. Links in Label type, Char ink; active link carries a short Punch underline-brick. Cart is a brick button with a Berry count stud; the avatar is a pill.
- **Mobile:** wordmark + cart + menu; nav collapses to a sheet.

### The Stack (signature component)
The build-your-own configurator renders the sandwich as a literal vertical stack of ingredient bricks. Adding an ingredient drops a brick onto the stack with the snap-settle; removing lifts it off; the running total lives at the base of the stack. This is the component that most expresses the North Star and should never be reduced to a plain checklist.

### Installed / PWA chrome
Stacked is an installable PWA. The manifest uses `display: standalone`, `theme-color` = Punch (`#ff5a2c`), and `background-color` = Counter for the splash. The app icon is a single Stacked brick (Punch on Counter) drawn inside a maskable safe area. Themed browser surfaces — selection, caret, scrollbar, focus ring — carry the palette so the installed app never shows raw browser defaults.

## Do's and Don'ts

### Do:
- **Do** let Punch own whole fields and the single primary action; keep other colors meaning-bearing.
- **Do** put dark Char ink on every bright brick (Grape is the only white-text exception).
- **Do** give bricks the two-layer stack shadow and the `translateY(3px)` snap-settle on press.
- **Do** snap every element to the 8px brick unit and the 1200px content grid.
- **Do** author real, appetizing sandwich imagery (photographic or clay-3D renders) and label synthetic content.
- **Do** theme the PWA and browser surfaces to the palette.

### Don't:
- **Don't** fall back to warm-cream grounds, serif display, or chalkboard-deli clichés — the category defaults this world rejects.
- **Don't** use a primary-only kindergarten palette or literal LEGO trademarks; the brick idea lives in form and motion, not in copying a toy.
- **Don't** use hard zero-blur block shadows or zero-offset colored halos for depth.
- **Don't** use gradient text, glass/blur as decoration, or soft-shadowed empty rounded rectangles standing in for content.
- **Don't** add an eyebrow/kicker label above headings, or letterspace Bricolage open.
- **Don't** scatter the snap motion across every hover — it is one authored moment per interaction.
