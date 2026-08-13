# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existing codebase (not a greenfield stack decision): AEM Edge Delivery Services as the headless content source, rendered by Next.js App Router + React Server Components, deployed on Cloudflare Workers via OpenNext. Persistence uses Cloudflare D1 (SQL) and KV.

## Users

Primary: hungry lunch customers ordering ahead for pickup — office workers, students, and neighborhood regulars deciding what to eat in the ~11am–2pm window, usually in a hurry and often reordering something they already love. Two jobs on one visit: pick a ready-made sandwich from a curated menu, or compose a custom sandwich layer by layer.

Secondary (the artifact's real audience): Adobe DevX and prospective customers evaluating what an Edge Delivery Services + Next.js build can do. Stacked is a fictional brand built as a capability demo, so the experience must read as a real, shippable product — never a toy.

## Product Purpose

Stacked lets someone order lunch two ways — shop a curated menu of signature sandwiches, or build their own from an authored ingredient palette — then save favorites, reorder in one tap, earn loyalty, and choose a pickup time. Customer success is a returning regular whose "usual" is one tap away. Demo success is proving that author-managed content (the menu) and a logged-in, persistent app (ordering, favorites, loyalty) live on one site and one deploy.

## Positioning

The menu and the build-your-own ingredient palette — including prices — are authored content, not hardcoded app data. A non-developer edits structured content in EDS — a menu item's page or the ingredients block — publishes, and both the menu and the configurator update at the edge. The thing a neighboring template can't copy: the same pages blend author-managed content with a personalized, persistent ordering app.

## Operating Context

Used on phones and laptops during a short lunch window, often one-handed and in a hurry. Repeat visits are the norm and the fastest path is reordering a saved sandwich. Content is authored in EDS (Docs/DA) and published via Sidekick; the app runs on Cloudflare (Next.js RSC + edge data).

## Capabilities and Constraints

- Shop a curated menu; build a custom sandwich with a live running price.
- Accounts with one-click demo personas (seeded); sessions in KV, users/orders/saved sandwiches/loyalty in D1.
- Cart plus simulated checkout: the order is saved, a confirmation and pickup time are shown, and a loyalty stamp is added — no real payment and no real inventory.
- Catalog (menu + ingredients + prices) is authored as EDS structured content — menu items as indexed pages, ingredients as a structured `Ingredients` block — not spreadsheets; orders capture a price/build snapshot at order time. See [content-schema.md](content-schema.md).
- Installable PWA: runs as a standalone installed app (web manifest, maskable icon, brand theme color, and an offline-tolerant app shell).

## Brand Commitments

- Name: Stacked (working brand; may be swapped later).
- Personality (user-pinned, binding for visual work): fun and whimsical, with a very modern, innovative UI.
- No real prices, customers, or claims — all menu and ingredient content is synthetic demonstration data and must be labeled as such where a visitor could mistake it for real.

## Evidence on Hand

- Working EDS + Next.js rendering pipeline: block registry, query-index, on-publish revalidation (this repo).
- Provisional UI mockups produced this session (menu, build-your-own, account) — direction placeholders, not the committed brand.
- No real customers, prices, order volumes, or testimonials exist; future work must not fabricate them.

## Product Principles

- Reorder beats reinvent: the returning customer's usual is the primary path.
- Authors own the menu; developers own the app; neither blocks the other.
- Demo-safe by default: everything works without real money, email, or inventory.
- Real product, not a toy: the demo must feel shippable end to end.

## Accessibility & Inclusion

Target WCAG 2.1 AA (project standard): legible contrast, keyboard-operable ordering and configurator, correct focus order, and labeled controls.
