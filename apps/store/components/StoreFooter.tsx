import Link from "next/link";
import { ClipboardList, Mail, MapPin, Phone } from "lucide-react";

export function StoreFooter() {
  return (
    <>
      <footer id="contact" className="gh-footer">
        <div className="gh-container gh-footer-grid">
          <div>
            <Link href="/" aria-label="Goodhand home">
              <img
                src="/brand/goodhand-logo.png"
                alt="Goodhand Security Products"
                width="180"
                height="60"
              />
            </Link>
            <p>
              Security products, professional installation, and dependable
              support for Filipino homes and businesses.
            </p>
            <a href="tel:+639172477556">
              <Phone size={15} />
              0917 247 7556
            </a>
            <a href="mailto:sales@goodhand88.com">
              <Mail size={15} />
              sales@goodhand88.com
            </a>
          </div>
          <div>
            <h3>Products</h3>
            <Link href="/products?category=cctv">CCTV & Surveillance</Link>
            <Link href="/products?category=radios">Two-Way Radios</Link>
            <Link href="/products?category=locks">Smart Locks & Access</Link>
            <Link href="/products?category=alarms">Alarm Systems</Link>
            <Link href="/products?category=network">Networking & WiFi</Link>
          </div>
          <div>
            <h3>Goodhand</h3>
            <Link href="/#services">Our Services</Link>
            <Link href="/#about">About Us</Link>
            <Link href="/leads">Free Site Inspection</Link>
            <Link href="/demo">Demo Panel</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
          <div>
            <h3>Visit a branch</h3>
            <p>
              Get advice on your setup and support for your security products.
            </p>
            <a
              href="https://www.stores.goodhand88.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <MapPin size={16} />
              Find your nearest branch →
            </a>
            <div className="gh-prototype-note">
              Student integration prototype.
              <br />
              Use demo information only.
            </div>
          </div>
        </div>
        <div className="gh-container gh-footer-bottom">
          © {new Date().getFullYear()} Goodhand Security Products · Academic
          demonstration
        </div>
      </footer>
      <Link href="/leads" className="gh-floating-book">
        <ClipboardList size={17} />
        <span>Book Site Inspection</span>
      </Link>
    </>
  );
}
