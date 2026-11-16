# Goodhand storefront design

The storefront was restyled on November 16, 2026 at the user's request, using
[Goodhand's original storefront](https://shop.goodhand88.com/index.html) and the
provided screenshots as visual references.

## Scope

- Dark navy navigation with the supplied Goodhand logo, account controls, cart
  badge, search, and a category menu.
- Responsive landing page with promotional artwork, category tiles, services,
  catalog, team photograph, installation steps, and inspection links.
- `/products` supports keyword search, category and brand filters, price ranges,
  sorting, and the existing Add to Cart behavior. The home catalog remains
  available at `/#catalog` for the H7 rehearsal.
- Products navigation now has grouped subcategory links modeled on the supplied
  reference. `lib/product-navigation.ts` defines the menu and explicit SKU
  membership. Subcategory URLs include `category` and `subcategory`; empty ranges
  show a clear catalog message. Menus support mouse, keyboard, mobile taps,
  Escape dismissal, and outside-click dismissal.
- Existing product SKUs, demo prices, cart persistence, checkout, authentication,
  and integration contracts are preserved. All 24 placeholder images have been
  replaced with individual AI-generated product illustrations, visibly labeled
  in the catalog. Canonical SKU paths refresh images for previously saved carts.
- The Windows-incompatible test command was changed to `vitest run`; pnpm
  resolves its local executable automatically.

## Reference assets

Local copies in `apps/store/public/brand/` prevent runtime dependencies on the
original website. The logo was supplied by the user. The promotional artwork,
four category images, and team photograph came from the public reference site.
These assets are used for the project's academic demonstration.

The 24 generated product illustrations are stored in
`apps/store/public/products/` as optimized 900px WebP files (about 1.2 MB total).
`docs/product-image-prompts.json` records every SKU, exact prompt, output path,
and generated source filename. The built-in image generation tool was used,
with one generation per product. These are illustrative representations based
on the listed names and features, not verified manufacturer photographs.
`scripts/clone-site.mjs` preserves this artwork when rebuilding catalog data.

## Verification

- Automated suite: 38 tests across 6 files.
- Contract checks: 16 clauses.
- Store production build and browser layout checks at 360, 768, and 1280 pixels.
- Browser smoke checks: category menu, product search, filters, add-to-cart, and
  navigation to the cart. Manual H7 sign-off remains with the human presenters.
