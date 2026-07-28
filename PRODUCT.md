# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the site owner, managing a personal update log from a browser. Readers are people who want to follow shipped changes, notes, and releases over time.

Confirmed author labels: `me` displays as Zeora and `openclaw` displays as 虾米. 虾米 is a second publishing persona controlled by the same owner, not a separate human account with independent login requirements.

## Product Purpose

This product is a lightweight changelog website with a visual admin console. It lets the owner write, preview, publish, edit, and archive update entries, then exposes a simple public timeline with static tag context and total published count.

Success means publishing a new update takes less than a minute, public readers can understand what changed quickly, and the system remains simple enough to run on Cloudflare Pages, Functions, and KV.

## Positioning

The product treats authorship as two visible publishing identities inside one personal control room: Zeora and 虾米 can each have their own color, voice, and byline while sharing one deployable CMS.

## Operating Context

The site runs as a Cloudflare Pages project. Static public screens are served from the site bundle, while Pages Functions handle JSON APIs and Cloudflare KV stores posts, indices, author metadata, slugs, revisions, and audit events.

The owner uses `/admin.html` as the editing cockpit. The public homepage reads from published KV indices and shows a timeline of entries.

## Capabilities and Constraints

Confirmed capabilities:

- Public changelog timeline with static tag context and total published count.
- Visual admin interface for drafts and published entries.
- Two controlled author personas: `me` / Zeora and `openclaw` / 虾米.
- Cloudflare KV storage with index keys optimized for read-heavy changelog browsing.
- Markdown-like body editing and preview.
- Username/password admin login when Cloudflare Access is not configured.

Confirmed constraints:

- KV is the primary database. The product should avoid relational assumptions, heavy transactions, and high-frequency writes to the same key.
- Large media should be referenced by URL or moved to object storage later rather than stored directly in KV.
- The first implementation should remain deployable without a custom backend server.

Open decisions:

- Final domain and avatar images are placeholders until replaced by the owner.
- Cloudflare Access policy details are deployment-time configuration, not hardcoded in the repo.

## Brand Commitments

Confirmed naming: Zeora and 虾米 are the two visible publishing names.

Assumption: the owner-facing tone should be precise, calm, and tool-like; the public surface can be warmer and more editorial.

## Evidence on Hand

The available source material is the user's brief requesting a changelog website, a visual admin backend, two controllable publishing users, and Cloudflare KV storage.

No existing logo, color system, customer claims, traffic numbers, screenshots, or production domain were provided. Future work should not fabricate those as factual proof.

## Product Principles

- Keep the write path direct: draft, preview, publish, done.
- Keep authorship visible without turning it into account complexity.
- Optimize public reads through precomputed KV indices.
- Make content portable through JSON exports and simple Markdown-like bodies.
- Prefer clear operational UI over decorative dashboards.

## Accessibility & Inclusion

The web interface should support keyboard navigation, visible focus states, semantic controls, readable contrast, and responsive layouts for desktop and mobile browsers.
