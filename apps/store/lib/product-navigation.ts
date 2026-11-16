export interface ProductSubcategory {
  id: string;
  label: string;
  category: string;
  skus: string[];
}

export interface ProductMenuGroup {
  title: string;
  items: ProductSubcategory[];
}

function item(
  id: string,
  label: string,
  category: string,
  ...skus: string[]
): ProductSubcategory {
  return { id, label, category, skus };
}

// Explicit SKU membership keeps the demo catalog accurate, including empty ranges.
export const productMenuGroups: Record<string, ProductMenuGroup[]> = {
  cctv: [
    {
      title: "CCTV Packages",
      items: [
        item("analog-packages", "Analog CCTV Packages", "cctv"),
        item("ip-packages", "IP Network CCTV Packages", "cctv"),
      ],
    },
    {
      title: "IP Network",
      items: [
        item("ip-camera", "IP Camera", "cctv", "GH-CCTV-001", "GH-CCTV-004"),
        item("ip-nvr", "IP NVR", "cctv"),
        item("poe-switch", "POE Switch", "network", "GH-NET-001"),
      ],
    },
    {
      title: "Analog (HDCVI / TVI)",
      items: [
        item(
          "analog-camera",
          "Analog Camera",
          "cctv",
          "GH-CCTV-002",
          "GH-CCTV-003",
        ),
        item("analog-dvr", "Analog DVR", "cctv"),
      ],
    },
    {
      title: "WIFI Camera",
      items: [
        item("4g-camera", "4G Camera", "cctv"),
        item("battery-camera", "Battery Camera", "cctv"),
        item("standalone-wifi", "Standalone WIFI", "cctv"),
        item("wifi-nvr", "WIFI NVR", "cctv"),
      ],
    },
  ],
  radios: [
    {
      title: "Two-Way Radios",
      items: [
        item("vhf-radio", "VHF Radios", "radios", "GH-RAD-001"),
        item("uhf-radio", "UHF Radios", "radios", "GH-RAD-003"),
        item("dual-band-radio", "Dual-Band Radios", "radios", "GH-RAD-002"),
      ],
    },
    {
      title: "Shop by Brand",
      items: [
        item("motorola", "Motorola", "radios", "GH-RAD-001"),
        item("baofeng", "Baofeng", "radios", "GH-RAD-002"),
        item("kenwood", "Kenwood", "radios", "GH-RAD-003"),
      ],
    },
  ],
  locks: [
    {
      title: "Smart Door Locks",
      items: [
        item(
          "fingerprint-locks",
          "Fingerprint Locks",
          "locks",
          "GH-LCK-001",
          "GH-LCK-002",
        ),
        item("rim-locks", "Digital Rim Locks", "locks", "GH-LCK-002"),
      ],
    },
    {
      title: "Access Control",
      items: [
        item("biometrics", "Biometric Terminals", "locks", "GH-LCK-003"),
        item("magnetic-locks", "Magnetic Locks", "locks", "GH-LCK-004"),
      ],
    },
  ],
  alarms: [
    {
      title: "Alarm Systems",
      items: [
        item("alarm-hubs", "WiFi & GSM Alarm Hubs", "alarms", "GH-ALM-001"),
        item("alarm-sirens", "Outdoor Sirens", "alarms", "GH-ALM-003"),
      ],
    },
    {
      title: "Sensors & Detectors",
      items: [
        item(
          "motion-detectors",
          "PIR Motion Detectors",
          "alarms",
          "GH-ALM-002",
        ),
        item("door-sensors", "Door & Window Sensors", "alarms", "GH-ALM-004"),
      ],
    },
  ],
  fence: [
    {
      title: "Perimeter Security",
      items: [
        item("energizers", "Electric Fence Energizers", "fence", "GH-FNC-001"),
        item("fence-sirens", "Sirens & Warning Beacons", "fence", "GH-FNC-002"),
      ],
    },
    {
      title: "Fence Accessories",
      items: [
        item("insulators", "Strain Insulators", "fence", "GH-FNC-003"),
        item("fence-wire", "Aluminum Fence Wire", "fence", "GH-FNC-004"),
      ],
    },
  ],
  network: [
    {
      title: "Switches & Connectivity",
      items: [
        item("poe-switch", "POE Switch", "network", "GH-NET-001"),
        item("cellular-routers", "4G LTE Routers", "network", "GH-NET-003"),
      ],
    },
    {
      title: "Cables & Infrastructure",
      items: [
        item("network-cables", "Cat6 Network Cables", "network", "GH-NET-002"),
      ],
    },
  ],
  storage: [
    {
      title: "Surveillance Storage",
      items: [
        item(
          "surveillance-hdd",
          "Surveillance Hard Drives",
          "storage",
          "GH-STR-001",
          "GH-STR-002",
        ),
      ],
    },
    {
      title: "Shop by Brand",
      items: [
        item("seagate", "Seagate SkyHawk", "storage", "GH-STR-001"),
        item("wd-purple", "Western Digital Purple", "storage", "GH-STR-002"),
      ],
    },
  ],
};

export function findProductSubcategory(id: string, category: string) {
  return Object.values(productMenuGroups)
    .flatMap((groups) => groups.flatMap((group) => group.items))
    .find((item) => item.id === id && item.category === category);
}

export function productSubcategoryHref(item: ProductSubcategory) {
  return `/products?category=${item.category}&subcategory=${item.id}`;
}
