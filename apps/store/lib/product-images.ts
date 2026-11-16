// Canonical paths also refresh images for carts saved before the artwork update.
const illustrationPaths: Record<string, string> = {
  "GH-CCTV-001": "/products/gh-cctv-001.webp",
  "GH-CCTV-002": "/products/gh-cctv-002.webp",
  "GH-CCTV-003": "/products/gh-cctv-003.webp",
  "GH-CCTV-004": "/products/gh-cctv-004.webp",
  "GH-ALM-001": "/products/gh-alm-001.webp",
  "GH-ALM-002": "/products/gh-alm-002.webp",
  "GH-ALM-003": "/products/gh-alm-003.webp",
  "GH-ALM-004": "/products/gh-alm-004.webp",
  "GH-LCK-001": "/products/gh-lck-001.webp",
  "GH-LCK-002": "/products/gh-lck-002.webp",
  "GH-LCK-003": "/products/gh-lck-003.webp",
  "GH-LCK-004": "/products/gh-lck-004.webp",
  "GH-FNC-001": "/products/gh-fnc-001.webp",
  "GH-FNC-002": "/products/gh-fnc-002.webp",
  "GH-FNC-003": "/products/gh-fnc-003.webp",
  "GH-FNC-004": "/products/gh-fnc-004.webp",
  "GH-RAD-001": "/products/gh-rad-001.webp",
  "GH-RAD-002": "/products/gh-rad-002.webp",
  "GH-RAD-003": "/products/gh-rad-003.webp",
  "GH-NET-001": "/products/gh-net-001.webp",
  "GH-NET-002": "/products/gh-net-002.webp",
  "GH-NET-003": "/products/gh-net-003.webp",
  "GH-STR-001": "/products/gh-str-001.webp",
  "GH-STR-002": "/products/gh-str-002.webp",
};

export function getProductImage(sku: string, fallback?: string) {
  return {
    src: illustrationPaths[sku] || fallback || "/brand/goodhand-logo.png",
    isIllustration: Boolean(illustrationPaths[sku]),
  };
}
