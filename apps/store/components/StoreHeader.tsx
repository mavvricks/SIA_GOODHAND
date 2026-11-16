"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  User,
  LogOut,
  Search,
  MapPin,
  ChevronDown,
  Menu,
  X,
  Camera,
  Radio,
  LockKeyhole,
  Bell,
  Zap,
  Network,
  HardDrive,
} from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import {
  productMenuGroups,
  productSubcategoryHref,
} from "@/lib/product-navigation";

export const categories = [
  { id: "cctv", label: "CCTV & Cameras", icon: Camera },
  { id: "radios", label: "Two-Way Radios", icon: Radio },
  { id: "locks", label: "Smart Locks & Access", icon: LockKeyhole },
  { id: "alarms", label: "Alarm Systems", icon: Bell },
  { id: "fence", label: "Electric Fence", icon: Zap },
  { id: "network", label: "Networking", icon: Network },
  { id: "storage", label: "Storage Devices", icon: HardDrive },
];

export function StoreHeader() {
  const { totalCount } = useCart();
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("cctv");
  const headerRef = useRef<HTMLElement>(null);
  const productsButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!productsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProductsOpen(false);
        productsButtonRef.current?.focus();
      }
    };
    const closeOutside = (event: PointerEvent) => {
      if (!headerRef.current?.contains(event.target as Node))
        setProductsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOutside);
    };
  }, [productsOpen]);
  const closeMenu = () => {
    setProductsOpen(false);
    setMobileOpen(false);
  };
  const selected = categories.find(
    (category) => category.id === activeCategory,
  )!;
  return (
    <header className="gh-header" ref={headerRef}>
      <div className="gh-container gh-nav-row">
        <Link href="/" className="gh-logo" aria-label="Goodhand home">
          <img
            src="/brand/goodhand-logo.png"
            alt="Goodhand Security Products"
            width="155"
            height="52"
          />
        </Link>
        <nav
          className={`gh-nav ${mobileOpen ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          <Link href="/" className={pathname === "/" ? "active" : ""}>
            Home
          </Link>
          <button
            ref={productsButtonRef}
            type="button"
            className={productsOpen || pathname === "/products" ? "active" : ""}
            aria-expanded={productsOpen}
            aria-controls="product-menu"
            onClick={() => setProductsOpen(!productsOpen)}
          >
            Products <ChevronDown size={12} />
          </button>
          <Link href="/#about">
            About Us <ChevronDown size={12} />
          </Link>
          <Link href="/#contact">Contact</Link>
          <Link href="/orders">My orders</Link>
          <a
            className="gh-locator"
            href="https://www.stores.goodhand88.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <MapPin size={15} /> Store Locator
          </a>
        </nav>
        <div className="gh-nav-actions">
          <Link
            href="/cart"
            className="gh-cart"
            aria-label={`Cart, ${totalCount} items`}
          >
            <ShoppingCart size={25} />
            <span>{totalCount}</span>
          </Link>
          {user ? (
            <div className="gh-user">
              <span title={`${user.fullName} (${user.role})`}>
                <User size={15} />
                <span>{user.fullName.split(" ")[0]}</span>
              </span>
              <button onClick={() => logout()} aria-label="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link className="gh-account" href="/login">
              <User size={15} />
              <span>Account</span>
            </Link>
          )}
          <Link className="gh-button gh-book-header" href="/leads">
            Book Free Inspection
          </Link>
          <button
            type="button"
            className="gh-mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      <div className="gh-search-row">
        <form
          action="/products"
          className="gh-container gh-search"
          role="search"
        >
          <label className="sr-only" htmlFor="site-search">
            Search products
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            placeholder="Search CCTV, smart locks, alarms, radios..."
          />
          <button aria-label="Search">
            <Search size={22} />
          </button>
        </form>
      </div>
      {productsOpen && (
        <div className="gh-mega-wrap" id="product-menu">
          <div className="gh-container gh-mega">
            <div className="gh-mega-categories">
              {categories.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  className={id === activeCategory ? "selected" : ""}
                  aria-pressed={id === activeCategory}
                  aria-controls="product-subcategories"
                  onMouseEnter={() => setActiveCategory(id)}
                  onFocus={() => setActiveCategory(id)}
                  onClick={() => setActiveCategory(id)}
                >
                  <Icon size={19} />
                  {label}
                  <span>›</span>
                </button>
              ))}
            </div>
            <div
              className="gh-mega-panel"
              id="product-subcategories"
              aria-label={`${selected.label} subcategories`}
            >
              <div className="gh-mega-content">
                {productMenuGroups[selected.id].map((group) => (
                  <section className="gh-mega-group" key={group.title}>
                    <h3>{group.title}</h3>
                    {group.items.map((item) => (
                      <Link
                        key={item.id}
                        href={productSubcategoryHref(item)}
                        onClick={closeMenu}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </section>
                ))}
              </div>
              <Link
                className="gh-mega-view-all"
                href={`/products?category=${selected.id}`}
                onClick={closeMenu}
              >
                Shop all {selected.label.toLowerCase()} →
              </Link>
            </div>
            <button
              className="gh-menu-close"
              aria-label="Close product menu"
              onClick={() => setProductsOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
