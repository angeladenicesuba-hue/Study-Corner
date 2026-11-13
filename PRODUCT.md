# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are front-desk staff, cashiers, and shop owners at **Study Corner MNL** (`Sta. Mesa / San Marcelino` branch) operating the counter during busy student check-in, food ordering, checkout, and shift-closing moments across Desktop PC, Tablet, and Phone devices.

## Product Purpose

Study Corner POS & Ledger manages end-to-end daily operations for a study hub: post-pay hourly student check-ins (`Time In` and `Who's In`), running food and drink tabs plus walk-in food orders (`Food POS`), multi-day study plan enrollments and lifetime membership card issuance (`Plans`), multi-method checkout with printable/viewable receipts, and daily/monthly sales, expense, and cash-drawer shift reconciliation (`Ledger`).

Success means staff can check students in and out, add food to tabs, and reconcile shifts quickly and accurately without calculation mistakes, data loss during internet or power interruptions, or visual clutter at the front desk.

## Positioning

A purpose-built, 100% offline-capable local Hub + PWA POS and ledger tailored specifically to Study Corner MNL's post-pay tiered hourly billing, automatic closing-time cap, lifetime membership tiers, and consecutive-day study plans—combining a local SQLite server (`server/`) with an automatic browser `localStorage` + Service Worker fallback and outbox sync (`web/src/offlineStore.ts`).

## Operating Context

- **Physical & Schedule Context:** Operated at `1943 Rd 5 Sta. Mesa / San Marcelino Ermita, Manila` during regular shop hours (`8:00 AM – 9:00 PM`). Free seating (no reservations) with complimentary coffee, tea, and drinking water.
- **Multi-Device LAN & Offline Setup:** Runs on a main counter PC (SQLite Hub on port `8787` / Vite web UI) and is accessed over local Wi-Fi/LAN by staff tablets and phones, with full offline continuity if the network or hub drops.
- **Closing Ritual:** At `8:45 PM`, staff receive a closing reminder banner if active study sessions remain open; at shift end, staff count physical drawer cash against expected cash, close the shift, and trigger automatic CSV/JSON backups.

## Capabilities and Constraints

- **Post-Pay Hourly Billing Rules:**
  - No grace period: any started hour counts as a full billable hour (minimum 1 hour).
  - Effective checkout time is automatically capped at closing hour (`9:00 PM` same day) so a forgotten `Time Out` never overcharges a student past shop hours.
  - Default Daily Rate Tiers (Non-Member / With Membership Card):
    - `1–2 hours`: ₱80 / ₱70
    - `3–5 hours`: ₱130 / ₱120
    - `6–10 hours`: ₱190 / ₱180
    - `11–13 hours`: ₱230 / ₱210
- **Study Plans & Lifetime Membership:**
  - One-time **Lifetime Membership Card** (`₱100` default, never expires) unlocks discounted Member rates across daily tiers and study plans.
  - Consecutive-day **Study Plans** cover time charges (`₱0` time charge during valid inclusive dates):
    - `Weekly (7 Days)`: ₱1,000 Non-Member / ₱800 Member
    - `Semi-Month (15 Days)`: ₱1,700 Non-Member / ₱1,500 Member
    - `Monthly (30 Days)`: ₱2,500 Non-Member / ₱2,200 Member
- **Food & Drinks Menu:**
  - Categories: `Iced Coffee & Drinks` (`iced_coffee`), `Non-Coffee Iced Drinks` (`non_coffee`), and `Lunch & Dinner` (`lunch_dinner`).
  - Items can be added either to an active student's running visit tab (`Who's In`) or sold standalone to walk-in customers (`Food POS`).
- **Payments, Receipts & Ledger:**
  - Supports `Cash`, `Card`, and `QR Ph` (GCash / Maya / bank QR Ph with staff-replaceable QR image in `Settings`), including split payments and discounts.
  - Generates itemized receipts (`ReceiptModal`) and exports monthly CSVs (`sales`, `payments`, `expenses`) plus JSON backups.

## Brand Commitments

- **Identity:** Study Corner (`Study Corner MNL`), with official shop logo at `web/public/logo.png`.
- **Clarity Mandate:** Keep all existing business context, workflows, and data intact, but present a clearer, calmer UI that avoids overwhelming users with dense or redundant information at once.

## Evidence on Hand

- Official logo asset: `web/public/logo.png`
- System guide and reference documentation: `Study_Corner_POS_Complete_Guide.html` and `Study_Corner_POS_Complete_Guide.pdf`
- Seeded menu products, rate tiers, and plan packages in `shared/billing.ts` and `web/src/offlineStore.ts`
- No external customer testimonials, marketing copy, or third-party payment gateway integrations exist and must not be fabricated.

## Product Principles

1. **Clarity Over Density:** Surface only the primary task and decision needed right now; tuck secondary reference tables, helper prose, and administrative details behind progressive disclosure so staff are never overwhelmed.
2. **Zero-Friction Counter Speed:** High-frequency front-desk actions (`Time In`, checking `Who's In`, adding a drink/meal to a tab, and `Time Out & Pay`) must require minimal taps and instant visual scanning.
3. **Uncompromised Business & Billing Integrity:** Every UI simplification must preserve Study Corner's exact billing rules, rate tiers, plan coverage logic, menu catalog, and ledger/shift accounting.
4. **Offline-First Reliability:** Staff must always be able to trust that check-ins, sales, and ledgers work seamlessly whether connected to the local SQLite hub or running in browser offline storage.
