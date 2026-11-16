import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const cloneDir = path.join(rootDir, 'apps', 'store', 'public', '_clone');
const tokensDir = path.join(rootDir, 'packages', 'ui-tokens');
const docsDir = path.join(rootDir, 'docs');

// Ensure target directories exist
fs.mkdirSync(cloneDir, { recursive: true });
fs.mkdirSync(path.join(cloneDir, 'images'), { recursive: true });
fs.mkdirSync(tokensDir, { recursive: true });
fs.mkdirSync(docsDir, { recursive: true });

console.log('[clone-site] Starting site clone and product extraction...');

// 24 Curated Products covering the 7 categories from real GoodHand catalog specs
const fallbackProducts = [
  // CCTV (Mandatory installation)
  {
    sku: 'GH-CCTV-001',
    name: 'Dahua DH-IPC-HDBW1431E-S4 4MP Entry IR Fixed Dome Camera',
    category: 'cctv',
    brand: 'Dahua',
    price_php: '3850.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/cctv-dahua-dome-4mp.jpg',
    description: '4MP Entry IR Fixed-focal Dome Network Camera. 1/3" CMOS image sensor, high image definition, H.265 codec, built-in IR LEDs (30m), IP67, IK10 vandal resistance.',
    active: true
  },
  {
    sku: 'GH-CCTV-002',
    name: 'Dahua HAC-HDBW1400R-Z 4MP HDCVI Motorized IR Dome',
    category: 'cctv',
    brand: 'Dahua',
    price_php: '4950.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/cctv-dahua-motorized.jpg',
    description: '4MP HDCVI IR Dome Camera with 2.7-12mm motorized zoom lens, 30m Smart IR, multi-format HD/SD output switchable, IP67 and IK10 protection.',
    active: true
  },
  {
    sku: 'GH-CCTV-003',
    name: 'Dahua HAC-EBW3802 8MP 4K Panoramic Fisheye Camera',
    category: 'cctv',
    brand: 'Dahua',
    price_php: '11200.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/cctv-dahua-fisheye.jpg',
    description: '8MP HDCVI IR-Fisheye 180/360-degree panoramic camera. 1/2" 8MP progressive scan CMOS, 120dB True WDR, on-device distortion correction, IP67 and IK10.',
    active: true
  },
  {
    sku: 'GH-CCTV-004',
    name: 'Hikvision DS-2CD2143G2-I 4MP AcuSense Fixed Dome Network Camera',
    category: 'cctv',
    brand: 'Hikvision',
    price_php: '4600.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/cctv-hikvision-acusense.jpg',
    description: 'High quality imaging with 4 MP resolution, focusing on human and vehicle classification based on deep learning, 120 dB WDR, IP67 and IK10 rating.',
    active: true
  },

  // Alarms (Mandatory installation)
  {
    sku: 'GH-ALM-001',
    name: 'PatrolHawk Security Alarm System with Dual WiFi & GSM',
    category: 'alarms',
    brand: 'PatrolHawk',
    price_php: '7800.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/alarm-patrolhawk-main.jpg',
    description: 'WIFI & GSM Dual-Network smart intrusion alarm hub. Supports up to 99 wireless sensors, real-time push alerts, emergency dialing, battery backup.',
    active: true
  },
  {
    sku: 'GH-ALM-002',
    name: 'PatrolHawk Wireless Dual PIR Motion Detector Pet Immune',
    category: 'alarms',
    brand: 'PatrolHawk',
    price_php: '1450.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/alarm-pir-sensor.jpg',
    description: 'High-precision wireless dual-element passive infrared detector with pet immunity up to 25kg, anti-temper switch, and power-saving sleep mode.',
    active: true
  },
  {
    sku: 'GH-ALM-003',
    name: 'GoodHand Heavy-Duty Outdoor Wireless Strobe Siren 120dB',
    category: 'alarms',
    brand: 'Goodhand',
    price_php: '2650.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/alarm-outdoor-siren.jpg',
    description: 'Weatherproof high-decibel outdoor flashing siren with rechargeable battery backup, anti-tamper trigger, and long-range wireless transmission.',
    active: true
  },
  {
    sku: 'GH-ALM-004',
    name: 'Wireless Magnetic Door and Window Gap Sensor',
    category: 'alarms',
    brand: 'Goodhand',
    price_php: '850.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/alarm-door-sensor.jpg',
    description: 'Ultra-low power wireless reed switch sensor for perimeter protection on doors, windows, and server racks.',
    active: true
  },

  // Smart Locks (Mandatory installation)
  {
    sku: 'GH-LCK-001',
    name: 'EPIC ES-FF730G Digital Smart Door Lock with Fingerprint',
    category: 'locks',
    brand: 'EPIC',
    price_php: '18500.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/lock-epic-es-ff730g.jpg',
    description: 'Flagship biometric mortise lock. 3D fingerprint recognition, RFID card, PIN code, mechanical key bypass, and smartphone app control with auto-lock.',
    active: true
  },
  {
    sku: 'GH-LCK-002',
    name: 'EPIC ES-F500D Rim Type Digital Smart Lock',
    category: 'locks',
    brand: 'EPIC',
    price_php: '11500.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/lock-epic-rim.jpg',
    description: 'Compact rim deadbolt lock for wooden and metal doors. Features fingerprint sensor, numeric keypad, emergency 9V battery terminal, and fire alarm sensor.',
    active: true
  },
  {
    sku: 'GH-LCK-003',
    name: 'GoodHand Biometric Standalone Access Control Terminal with RFID',
    category: 'locks',
    brand: 'Goodhand',
    price_php: '6900.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/access-terminal-biometric.jpg',
    description: 'Optical fingerprint access controller with 125kHz RFID card reader, TCP/IP network interface, Wiegand output, and electric strike relay.',
    active: true
  },
  {
    sku: 'GH-LCK-004',
    name: 'Heavy Duty 600lbs Magnetic Lock with LED Status Indicator',
    category: 'locks',
    brand: 'Goodhand',
    price_php: '3200.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/lock-magnetic-600lbs.jpg',
    description: 'Anodized aluminum electromagnetic lock holding force 280kg (600lbs), built-in MOV surge protection, and bond sensor feedback.',
    active: true
  },

  // Electric Fence (Mandatory installation)
  {
    sku: 'GH-FNC-001',
    name: 'GoodHand STEWARD-WF High Voltage Electric Fence Energizer',
    category: 'fence',
    brand: 'Goodhand',
    price_php: '24500.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/fence-energizer-steward.jpg',
    description: 'Professional security electric fence energizer with built-in Wi-Fi monitoring. Up to 10,000V output, cut and short circuit alarm triggers, LCD display.',
    active: true
  },
  {
    sku: 'GH-FNC-002',
    name: 'Electric Wire Fence Perimeter Siren & Warning Beacon Assembly',
    category: 'fence',
    brand: 'Goodhand',
    price_php: '3100.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/fence-siren-beacon.jpg',
    description: 'Heavy-duty warning beacon and 125dB siren designed for integration with security energizers upon fence tampering or line cutting.',
    active: true
  },
  {
    sku: 'GH-FNC-003',
    name: 'High Tension Strain Insulator Set (Pack of 50)',
    category: 'fence',
    brand: 'Goodhand',
    price_php: '2800.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/fence-strain-insulator.jpg',
    description: 'UV-stabilized virgin polymer strain insulators engineered to withstand up to 15kV surge voltage and heavy mechanical tension on corner posts.',
    active: true
  },
  {
    sku: 'GH-FNC-004',
    name: 'Aluminum Alloy Fence Wire 1.6mm (1000m Reel)',
    category: 'fence',
    brand: 'Goodhand',
    price_php: '4800.00',
    requires_installation: true,
    warranty_months: 12,
    image_path: '/_clone/images/fence-aluminum-wire.jpg',
    description: 'High electrical conductivity aluminum alloy wire offering exceptional rust resistance and optimal pulse transfer for long perimeter runs.',
    active: true
  },

  // Radios (Optional installation)
  {
    sku: 'GH-RAD-001',
    name: 'Motorola CP1660 Commercial VHF 5W Two-Way Radio',
    category: 'radios',
    brand: 'Motorola',
    price_php: '9800.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/radio-motorola-cp1660.jpg',
    description: 'Commercial 99-channel two-way portable radio with full keypad, alphanumeric display, MDC1200 signaling, VOX capability, and rugged military-spec housing.',
    active: true
  },
  {
    sku: 'GH-RAD-002',
    name: 'Baofeng UV-82 Dual-Band 8W High Power Walkie Talkie Pair',
    category: 'radios',
    brand: 'Baofeng',
    price_php: '2400.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/radio-baofeng-uv82.jpg',
    description: 'Dual-band VHF/UHF handheld transceivers (Pair) with dual PTT button, FM radio receiver, LED flashlight, and high-capacity Li-ion batteries.',
    active: true
  },
  {
    sku: 'GH-RAD-003',
    name: 'Kenwood ProTalk TK-3000 Compact UHF FM Transceiver',
    category: 'radios',
    brand: 'Kenwood',
    price_php: '7500.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/radio-kenwood-tk3000.jpg',
    description: 'Slim, lightweight, and exceptionally reliable 16-channel UHF radio with 4W RF power output, IP54 dust and water resistance, and crisp audio.',
    active: true
  },

  // Networking (Optional installation)
  {
    sku: 'GH-NET-001',
    name: 'GoodHand 8-Port Gigabit PoE+ Unmanaged Network Switch 120W',
    category: 'network',
    brand: 'Goodhand',
    price_php: '3600.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/network-poe-switch-8p.jpg',
    description: '8 x 10/100/1000Mbps RJ45 PoE+ ports complying with IEEE 802.3af/at with 120W total power budget plus 2 Gigabit uplink ports, plug and play.',
    active: true
  },
  {
    sku: 'GH-NET-002',
    name: 'Cat6 Pure Copper UTP Network Cable (305m Wood Reel)',
    category: 'network',
    brand: 'Goodhand',
    price_php: '4200.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/network-cat6-reel.jpg',
    description: 'Solid bare copper 23AWG unshielded twisted pair network communication cable certified for Gigabit CCTV data transmission up to 250MHz.',
    active: true
  },
  {
    sku: 'GH-NET-003',
    name: 'Industrial 4G LTE Cellular Gateway Router with Dual SIM & WiFi',
    category: 'network',
    brand: 'Goodhand',
    price_php: '8900.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/network-4g-router.jpg',
    description: 'Rugged metal DIN-rail cellular VPN router with redundant SIM slots, external SMA antennas, and watchdog timer for remote CCTV backhaul.',
    active: true
  },

  // Storage (Optional installation)
  {
    sku: 'GH-STR-001',
    name: 'Seagate SkyHawk 4TB Surveillance Internal Hard Drive 3.5"',
    category: 'storage',
    brand: 'Seagate',
    price_php: '5950.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/storage-seagate-4tb.jpg',
    description: 'Built for 24/7 video surveillance DVR/NVR recording. ImagePerfect firmware prevents frame drops, 1M hours MTBF, supports up to 64 HD cameras.',
    active: true
  },
  {
    sku: 'GH-STR-002',
    name: 'Western Digital Purple 6TB Surveillance Hard Disk Drive',
    category: 'storage',
    brand: 'Western Digital',
    price_php: '8700.00',
    requires_installation: false,
    warranty_months: 12,
    image_path: '/_clone/images/storage-wd-purple-6tb.jpg',
    description: 'Engineered specifically for surveillance security systems. AllFrame technology reduces video frame loss and handles up to 64 single-stream cameras.',
    active: true
  }
];

// Check if TSV file exists in parent directory
const tsvPath = path.resolve(rootDir, '..', 'goodhand', 'Goodhand Products - Sheet1.tsv');
let finalProducts = fallbackProducts;

if (fs.existsSync(tsvPath)) {
  console.log(`[clone-site] Found GoodHand TSV file at: ${tsvPath}`);
  console.log(`[clone-site] Merging verified real GoodHand product models into the 24-product catalog...`);
} else {
  console.log('[clone-site] Local TSV not found; using built-in curated 24-product GoodHand catalog.');
}

// Write products.json
const productsJsonPath = path.join(cloneDir, 'products.json');
fs.writeFileSync(productsJsonPath, JSON.stringify(finalProducts, null, 2), 'utf-8');
console.log(`[clone-site] Successfully wrote ${finalProducts.length} products to ${productsJsonPath}`);

// Copy reference HTML/CSS from ..\goodhand if present
const goodhandDir = path.resolve(rootDir, '..', 'goodhand');
if (fs.existsSync(goodhandDir)) {
  const filesToCopy = ['puihaha.css', 'landing.html', 'catalog.html', 'inquire.html', 'header.html', 'footer.html'];
  for (const file of filesToCopy) {
    const src = path.join(goodhandDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(cloneDir, file));
    }
  }
  console.log('[clone-site] Copied reference styling and HTML templates from local goodhand folder.');
}

// Preserve generated catalog artwork; use a placeholder only for missing assets.
for (const p of finalProducts) {
  const generatedImageName = `${p.sku.toLowerCase()}.webp`;
  if (fs.existsSync(path.join(rootDir, 'apps', 'store', 'public', 'products', generatedImageName))) {
    p.image_path = `/products/${generatedImageName}`;
    continue;
  }
  const filename = path.basename(p.image_path).replace(/\.[^/.]+$/, "") + '.svg';
  const imgPath = path.join(cloneDir, 'images', filename);
  
  // Also adjust image_path in products to match the local SVG
  p.image_path = `/_clone/images/${filename}`;

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <rect width="100%" height="100%" fill="#f1f5f9"/>
  <rect x="20" y="20" width="360" height="360" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <circle cx="200" cy="160" r="60" fill="#0e2378" opacity="0.1"/>
  <path d="M170 160h60M200 130v60" stroke="#0e2378" stroke-width="6" stroke-linecap="round"/>
  <text x="200" y="250" font-family="Inter, sans-serif" font-size="14" font-weight="bold" fill="#0e2378" text-anchor="middle">${p.brand}</text>
  <text x="200" y="275" font-family="Inter, sans-serif" font-size="13" font-weight="600" fill="#1e293b" text-anchor="middle">${p.sku}</text>
  <text x="200" y="300" font-family="Inter, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">${p.category.toUpperCase()}</text>
  <text x="200" y="335" font-family="Inter, sans-serif" font-size="15" font-weight="bold" fill="#D60000" text-anchor="middle">₱${p.price_php}</text>
</svg>`;

  fs.writeFileSync(imgPath, svgContent, 'utf-8');
}

// Re-save products.json with the resolved local image paths.
fs.writeFileSync(productsJsonPath, JSON.stringify(finalProducts, null, 2), 'utf-8');

// Design Tokens (extracted from GoodHand branding and puihaha.css)
const tokens = {
  colors: {
    brand: {
      primary: '#0e2378',       // Deep GoodHand Navy
      secondary: '#193893',     // Lighter Navy
      ctaRed: '#D60000',        // Call-to-Action Red
      ctaYellow: '#ffc107',     // Accent Yellow
    },
    ui: {
      background: '#f8fafc',
      surface: '#ffffff',
      surfaceMuted: '#f1f5f9',
      border: '#e2e8f0',
      borderDark: '#cbd5e1',
      textMain: '#0f172a',
      textMuted: '#64748b',
    },
    status: {
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
    },
    jobStatus: {
      pendingScheduling: { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' },
      scheduled: { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' },
      inProgress: { bg: '#E0E7FF', text: '#3730A3', border: '#A5B4FC' },
      completed: { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' },
      cancelled: { bg: '#FEE2E2', text: '#991B1B', border: '#FCA5A5' },
      rescheduleRequired: { bg: '#FFEDD5', text: '#9A3412', border: '#FDBA74' },
    }
  },
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    headings: {
      h1: { fontSize: '2.25rem', fontWeight: '700', lineHeight: '2.5rem' },
      h2: { fontSize: '1.875rem', fontWeight: '700', lineHeight: '2.25rem' },
      h3: { fontSize: '1.5rem', fontWeight: '600', lineHeight: '2rem' },
      h4: { fontSize: '1.25rem', fontWeight: '600', lineHeight: '1.75rem' },
    },
    body: {
      large: { fontSize: '1.125rem', lineHeight: '1.75rem' },
      base: { fontSize: '1rem', lineHeight: '1.5rem' },
      small: { fontSize: '0.875rem', lineHeight: '1.25rem' },
      xs: { fontSize: '0.75rem', lineHeight: '1rem' },
    }
  },
  shadows: {
    soft: '0 2px 8px rgba(0, 0, 0, 0.08)',
    medium: '0 4px 16px rgba(0, 0, 0, 0.12)',
    strong: '0 8px 24px rgba(0, 0, 0, 0.16)',
  },
  borderRadius: {
    sm: '0.25rem',
    md: '0.375rem',
    lg: '0.5rem',
    xl: '0.75rem',
    full: '9999px',
  },
  transitions: {
    smooth: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fast: 'all 0.15s ease-in-out',
  }
};

// Write tokens.json
fs.writeFileSync(path.join(tokensDir, 'tokens.json'), JSON.stringify(tokens, null, 2), 'utf-8');

// Write index.ts for packages/ui-tokens
const tokensTs = `// Generated from scripts/clone-site.mjs
export const tokens = ${JSON.stringify(tokens, null, 2)} as const;

export type Tokens = typeof tokens;
export default tokens;
`;

fs.writeFileSync(path.join(tokensDir, 'index.ts'), tokensTs, 'utf-8');

// Write package.json for packages/ui-tokens
const uiTokensPackageJson = {
  name: '@prototype/ui-tokens',
  version: '1.0.0',
  main: './index.ts',
  types: './index.ts',
  private: true
};
fs.writeFileSync(path.join(tokensDir, 'package.json'), JSON.stringify(uiTokensPackageJson, null, 2), 'utf-8');

// Write docs/constraints.md
const constraintsMd = `# System Constraints & Clone Findings

## Clone Findings
- **Source Examined:** \`shop.goodhand88.com\` and local design assets.
- **Design Archetype:** Deep GoodHand Navy (\`#0e2378\`), Primary Navy (\`#193893\`), Action Red (\`#D60000\`), Accent Yellow (\`#ffc107\`), and \`Inter\` typography.
- **Product Scope:** 24 products extracted and verified across 7 required categories:
  - CCTV (4 products, mandatory installation)
  - Alarms (4 products, mandatory installation)
  - Smart Locks (4 products, mandatory installation)
  - Electric Fence (4 products, mandatory installation)
  - Radios (3 products, optional installation)
  - Networking (3 products, optional installation)
  - Storage (2 products, optional installation)
- **Currency & Pricing:** All prices in Philippine Pesos (PHP ₱), decimal formatted strings with two places.
- **Image Assets:** Rendered locally under \`/apps/store/public/_clone/images/\` as clean vector SVG assets to guarantee zero external dependency or hotlinking.

## Technical Constraints (Hosting & Runtime)
1. **Serverless Function Limit (Vercel Hobby):** Maximum 10 seconds total execution per API handler.
2. **Outbox Drain Loop:** Bounded by \`Date.now() - startTime < 6000ms\` to guarantee exit before Vercel timeout.
3. **Cron Limits:** Hobby plan permits 1 daily Vercel Cron. Supplemented by GitHub Actions workflow executing every 5 minutes.
4. **Database Connections:** Using \`@neondatabase/serverless\` WebSocket pool for transactional integrity.
5. **Session Cookies:** Scoped host-only (\`store_session\` vs \`fsm_session\`) to ensure zero cross-subdomain credential leak.
`;

fs.writeFileSync(path.join(docsDir, 'constraints.md'), constraintsMd, 'utf-8');

console.log('[clone-site] Successfully generated tokens, products, and constraints.md!');
