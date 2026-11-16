import type { UserSession } from "./auth";

export const technicians = [
  {
    id: "tech-uuid-1",
    code: "TECH-001",
    name: "Arnel Mendoza",
    email: "arnel.mendoza@fsm.local",
    qualifications: ["CCTV", "ALM", "LCK"],
  },
  {
    id: "tech-uuid-2",
    code: "TECH-002",
    name: "Danilo Reyes",
    email: "danilo.reyes@fsm.local",
    qualifications: ["FNC", "NET"],
  },
  {
    id: "tech-uuid-3",
    code: "TECH-003",
    name: "Crispin Bautista",
    email: "crispin.bautista@fsm.local",
    qualifications: ["CCTV", "NET"],
  },
  {
    id: "tech-uuid-4",
    code: "TECH-004",
    name: "Eduardo Lim",
    email: "eduardo.lim@fsm.local",
    qualifications: ["LCK", "ALM", "CCTV"],
  },
  {
    id: "tech-uuid-5",
    code: "TECH-005",
    name: "Fernando Garcia",
    email: "fernando.garcia@fsm.local",
    qualifications: ["FNC", "ALM"],
  },
  {
    id: "tech-uuid-6",
    code: "TECH-006",
    name: "Gabriel Soriano",
    email: "gabriel.soriano@fsm.local",
    qualifications: ["CCTV", "NET", "RAD"],
  },
];

export function technicianForUser(user: UserSession) {
  return user.role === "technician"
    ? technicians.find((tech) => tech.email === user.email)
    : undefined;
}

export function isQualified(
  technician: (typeof technicians)[number],
  items: Array<{ sku: string }>,
) {
  return items.every(
    (item) =>
      item.sku.split("-")[1] === "STR" ||
      technician.qualifications.includes(item.sku.split("-")[1]),
  );
}
