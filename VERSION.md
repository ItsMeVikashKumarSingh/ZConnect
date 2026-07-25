# VERSION HISTORY

## [0.3.1] - 2026-07-25
- Fixed mobile responsive layout viewport expansion issue by adding `overflow-x-hidden` and `w-full max-w-full` constraints to the page wrapper and root layout.
- Constrained ambient blur glow elements to prevent horizontal viewport scrolling and half-screen shrinking on mobile screens.
- Adapted hero stats grid padding and accent color selector grids for small mobile viewports.

## [0.3.0] - 2026-07-25
- Integrated Backblaze B2 private storage for chat attachments (PUT presigned upload URLs and GET pre-signed download URLs).
- Added multi-platform Tenant Integrations Management interface under `/dashboard/integrations` supporting Slack, Discord, MS Teams, Telegram, and Custom Webhooks.
- Added cryptographic AES-256-GCM webhook credentials protection in the database.
- Implemented real-time messaging synchronization using secure Server-Sent Events (SSE) streams in both client widget (`/widget`) and operator dashboard (`/dashboard`), replacing 4.5-second interval polling with sub-second updates.
- Verified build and zero warnings compliance.

## [0.2.4] - 2026-07-19
- Full responsive overhaul across all landing page sections.
- Added mobile hamburger navigation drawer (hidden on md+, appears on mobile tap).
- Nav Sign In button hidden on smallest screens to prevent header overflow.
- "Launch Portal" button adapts size between mobile and desktop breakpoints.
- Hero section font scaling: `text-3xl sm:text-4xl md:text-6xl`.
- All sections use `px-4 md:px-6` and `py-12 md:py-20` responsive spacing.
- Simulator sandbox header condensed for mobile: truncated title, hidden subtitle on xs, smaller Reset button.
- Simulator panel no longer constrained to `max-w-6xl`; fills container on mobile.
- Features, Playground, Security, and Footer sections now fully mobile-friendly.

## [0.2.3] - 2026-07-19
- Added custom brand-aligned SVG favicon (`icon.svg`) matching Navy/Gold colors.
- Removed legacy Next.js `favicon.ico` to prevent runtime favicon conflicts.
- Migrated layout metadata `viewport` config to separate viewport constant, resolving Next.js build console warnings.
- Renamed the mock browser hero preview header from "ZConnect Agent Hub" to "ZConnect Support Portal".

## [0.2.2] - 2026-07-19
- Removed "3. Live Support Sandbox" as a standalone feature card.
- Added "Preview Widget" button to Card 1 and "Preview Console" button to Card 2.
- Clicking a card button expands its specific inline preview below the cards (User Widget or Agent Console, not both).
- Card gets a colored ring highlight when its preview is active.
- Reset and close controls available in the inline preview header.
- Full-screen modal overlay removed; simulator is now context-aware and inline.

## [0.2.1] - 2026-07-19
- Removed "Support Sandbox Simulation" hero badge from landing page.
- Removed full-screen modal overlay for the Live Support Sandbox simulator.
- Embedded the full Live Sandbox simulator inline inside Feature Card 3 — expands in-place on click, no page navigation required.
- Replaced "Live Simulator" nav button (which opened overlay) with a smooth `#chat-capabilities` anchor link.
- Replaced hero "Launch Live Simulator" button with a "See Live Sandbox" anchor scroll link.
- Added Reset button and Hide/Show toggle on the inline simulator card header.
- Removed extra "Support Sandbox Simulation" badge that persisted in the `zorvik-chat` source.

## [0.2.0] - 2026-07-19
- Overhauled ZConnect web application with new corporate identity (Navy Blue `#0D2B5C` and Gold `#D4A017`).
- Implemented a complete client-side Theme Engine (Light, Dark, and System modes) and preset Accent Colors (Navy, Blue, Indigo, Purple, Emerald, Cyan, Orange, Rose).
- Built a premium marketing landing page at `/` with interactive live widgets and layout playground.
- Redesigned Portal login page, dashboards, FAQ editor, and superadmin views with sleek cards, shadows, and spacing.
- Redesigned the floating chat widget launcher, lead capture forms, FAQ search, live chat threads, and suggestions.
- Implemented full responsiveness for all desktop, tablet, and mobile viewports.

## [0.1.1] - 2026-07-19
- Renamed the support platform software to `ZConnect`.
- Customized the application branding theme colors to match the metallic Zorvik Tech logo identity (Metallic Steel Blue `#2a4b7c` and Metallic Gold `#d4af37`).
- Updated package.json configs, login wrappers, and workspace console headers.

## [0.1.0] - 2026-07-19
- Initial implementation of the Standalone Support Chat Platform (`zorvik-chat`).
- Implemented secure Pluggable & Secure Dual-Access Architecture (Direct password login and token-based embedded access).
- Added timing attack protection for JWT token signatures using Node's `crypto.timingSafeEqual`.
- Sanitized referrer metadata links to block `javascript:` URI protocol XSS injections.
- Migrated all database structures to `management.tbl_chat_*` tables to bypass PostgREST custom schema restrictions.
- Aligned project background theme, glassmorphic panels, scrollbars, and layouts with the Zorvik Tech landing page.
