import Link from "next/link";
import {
  ArrowRight,
  Camera,
  Zap,
  Bell,
  LockKeyhole,
  Radio,
  Wrench,
  Check,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { StoreHeader } from "@/components/StoreHeader";
import { StoreFooter } from "@/components/StoreFooter";
import { ProductCatalog } from "@/components/ProductCatalog";
import { getProducts } from "@/lib/products";

const services = [
  {
    title: "CCTV Installation",
    icon: Camera,
    category: "cctv",
    text: "Keep an eye on your home or business with clear video, remote viewing, and a professionally fitted camera system.",
  },
  {
    title: "Electric Fence",
    icon: Zap,
    category: "fence",
    text: "Protect your perimeter with a security fence designed around your property and installed by qualified technicians.",
  },
  {
    title: "Alarm Systems",
    icon: Bell,
    category: "alarms",
    text: "Stay informed with motion detection, door sensors, and alerts that help you respond when it matters.",
  },
  {
    title: "Smart Door Locks",
    icon: LockKeyhole,
    category: "locks",
    text: "Make everyday access easier with fingerprint, PIN, and card entry for homes and workplaces.",
  },
  {
    title: "Two-Way Radios",
    icon: Radio,
    category: "radios",
    text: "Keep your team connected with dependable radios for security, operations, and day-to-day coordination.",
  },
  {
    title: "Maintenance & Support",
    icon: Wrench,
    category: "",
    text: "Keep your system working at its best with troubleshooting, equipment upgrades, and after-sales assistance.",
  },
];
const steps = [
  [
    "Tell us what you need",
    "Choose your products or request advice on the right setup.",
  ],
  [
    "Book a site inspection",
    "Plan the equipment and coverage your property needs.",
  ],
  ["Confirm your order", "Review your hardware and installation requirements."],
  [
    "Leave the install to us",
    "Track your assigned technician and installation schedule.",
  ],
  [
    "Enjoy peace of mind",
    "Access your warranties and share feedback after completion.",
  ],
];

export default function HomePage() {
  return (
    <div className="gh-site">
      <StoreHeader />
      <section className="gh-promotion" aria-label="Goodhand online store">
        <Link href="/products">
          <picture>
            <source
              media="(max-width: 600px)"
              srcSet="/brand/promotion-mobile.webp"
            />
            <img
              src="/brand/promotion.webp"
              alt="Goodhand online store — security products for a safer home"
              width="1600"
              height="600"
              fetchPriority="high"
            />
          </picture>
        </Link>
      </section>
      <section className="gh-container gh-category-section">
        <div className="gh-heading-row">
          <h2>Shop by Category</h2>
          <Link href="/products">
            View all products <ArrowRight size={16} />
          </Link>
        </div>
        <div className="gh-category-grid">
          {[
            { id: "cctv", title: "CCTV Cameras", image: "cctv" },
            { id: "locks", title: "Smart Locks & Access", image: "locks" },
            { id: "radios", title: "Two-Way Radios", image: "radios" },
            { id: "storage", title: "Storage Devices", image: "storage" },
          ].map((c) => (
            <Link
              key={c.id}
              href={`/products?category=${c.id}`}
              className="gh-category-card"
            >
              <img
                src={`/brand/category-${c.image}.webp`}
                alt=""
                width="200"
                height="160"
              />
              <span>
                {c.title}
                <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section className="gh-intro">
        <div className="gh-container gh-intro-grid">
          <div>
            <span className="gh-eyebrow">
              People · Property · Peace of mind
            </span>
            <h1>
              Your home. Your business.
              <br />
              <span>In good hands.</span>
            </h1>
            <p>
              Build a safer space with trusted security products and
              professional installation. From choosing your cameras to getting
              everything up and running, we’re here to help.
            </p>
            <div className="gh-hero-actions">
              <Link className="gh-button" href="/products">
                Shop Security Products <ArrowRight size={17} />
              </Link>
              <Link className="gh-outline-button" href="/leads">
                Book a Free Site Inspection
              </Link>
            </div>
          </div>
          <aside className="gh-help-card">
            <ShieldCheck size={32} />
            <h2>
              A complete security setup,
              <br />
              without the guesswork.
            </h2>
            <p>
              Find the right equipment, book installation, and follow your order
              through to completion.
            </p>
            <Link href="/leads">
              Let’s plan your setup <ArrowRight size={17} />
            </Link>
            <div>
              <span>
                <Check size={15} />
                Genuine security hardware
              </span>
              <span>
                <Check size={15} />
                Professional installation
              </span>
              <span>
                <Check size={15} />
                Hardware warranty
              </span>
            </div>
          </aside>
        </div>
      </section>
      <section id="services" className="gh-container gh-section">
        <div className="gh-section-heading">
          <span className="gh-eyebrow">What we do</span>
          <h2>
            Complete Security: Supply + Installation
            <br className="gh-desktop-break" /> + Support
          </h2>
          <p>
            One team to help you choose, install, and maintain your security
            system.
            <br className="gh-desktop-break" /> Kami na ang bahala.
          </p>
        </div>
        <div className="gh-services-grid">
          {services.map(({ title, icon: Icon, text, category }) => (
            <article className="gh-service-card" key={title}>
              <div className="gh-service-icon">
                <Icon size={23} strokeWidth={1.8} />
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
              <Link
                href={category ? `/products?category=${category}` : "/leads"}
              >
                Learn more →
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section id="catalog" className="gh-catalog-section">
        <div className="gh-container gh-section">
          <div className="gh-section-heading">
            <span className="gh-eyebrow">Shop with Goodhand</span>
            <h2>Security for every space</h2>
            <p>
              Explore our hardware catalog and build your installation order.
            </p>
          </div>
          <ProductCatalog products={getProducts()} />
        </div>
      </section>
      <section id="about" className="gh-container gh-section">
        <div className="gh-about-grid">
          <div>
            <span className="gh-eyebrow">Why Goodhand</span>
            <h2>
              The security partner na hindi ka
              <br className="gh-desktop-break" /> iiwan after the sale
            </h2>
            <ul className="gh-checklist">
              {[
                [
                  "Trusted equipment",
                  "Choose from established security brands for your home or business.",
                ],
                [
                  "Support close to home",
                  "Connect with the Goodhand branch network for advice and after-sales help.",
                ],
                [
                  "An experienced team",
                  "Security know-how built through years of serving Filipino customers.",
                ],
                [
                  "Installation made easier",
                  "Your hardware order and technician schedule stay connected.",
                ],
                [
                  "Warranty you can track",
                  "See your installed equipment and hardware warranties in your order.",
                ],
              ].map(([title, text]) => (
                <li key={title}>
                  <Check size={15} />
                  <span>
                    <strong>{title}:</strong> {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <img
            className="gh-team-photo"
            src="/brand/goodhand-team.jpg"
            alt="The Goodhand Security Products team"
            width="800"
            height="533"
            loading="lazy"
          />
        </div>
        <div className="gh-section-heading gh-process-heading">
          <span className="gh-eyebrow">How it works</span>
          <h2>From your first inquiry to a safer space</h2>
        </div>
        <div className="gh-steps">
          {steps.map(([title, text], i) => (
            <article key={title}>
              <span>{String(i + 1).padStart(2, "0")}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="gh-container gh-final-section">
        <div className="gh-cta-band">
          <ClipboardList size={30} />
          <h2>Ready to secure your space?</h2>
          <p>
            Let’s find the right security solution for your home or business.
          </p>
          <Link href="/leads" className="gh-button">
            Book Free Site Inspection <ArrowRight size={17} />
          </Link>
        </div>
      </section>
      <StoreFooter />
    </div>
  );
}
