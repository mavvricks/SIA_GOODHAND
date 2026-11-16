# System Constraints & Clone Findings

## Clone Findings
- **Source Examined:** `shop.goodhand88.com` and local design assets.
- **Design Archetype:** Deep GoodHand Navy (`#0e2378`), Primary Navy (`#193893`), Action Red (`#D60000`), Accent Yellow (`#ffc107`), and `Inter` typography.
- **Product Scope:** 24 products extracted and verified across 7 required categories:
  - CCTV (4 products, mandatory installation)
  - Alarms (4 products, mandatory installation)
  - Smart Locks (4 products, mandatory installation)
  - Electric Fence (4 products, mandatory installation)
  - Radios (3 products, optional installation)
  - Networking (3 products, optional installation)
  - Storage (2 products, optional installation)
- **Currency & Pricing:** All prices in Philippine Pesos (PHP ₱), decimal formatted strings with two places.
- **Image Assets:** Rendered locally under `/apps/store/public/_clone/images/` as clean vector SVG assets to guarantee zero external dependency or hotlinking.

## Technical Constraints (Hosting & Runtime)
1. **Serverless Function Limit (Vercel Hobby):** Maximum 10 seconds total execution per API handler.
2. **Outbox Drain Loop:** Bounded by `Date.now() - startTime < 6000ms` to guarantee exit before Vercel timeout.
3. **Cron Limits:** Hobby plan permits 1 daily Vercel Cron. Supplemented by GitHub Actions workflow executing every 5 minutes.
4. **Database Connections:** Using `@neondatabase/serverless` WebSocket pool for transactional integrity.
5. **Session Cookies:** Scoped host-only (`store_session` vs `fsm_session`) to ensure zero cross-subdomain credential leak.
