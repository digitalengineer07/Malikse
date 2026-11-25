import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "../web/privacy.css";

export const privacyContact = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL || "support@malikse.in";
export const placeholderContact = privacyContact.endsWith(".example");

export default function PrivacyLayout({
  title,
  eyebrow,
  lead,
  meta,
  children,
}: {
  title: string;
  eyebrow: string;
  lead?: string;
  meta?: string;
  children: React.ReactNode;
}) {
  const shell = useRef<HTMLDivElement>(null);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    document.title = `${pathname === "/privacy-policy" ? "Privacy Policy" : "Delete Account"} | MalikSe`;
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView({ behavior: "smooth" });
    else shell.current?.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="privacy-shell" ref={shell}>
      <header className="privacy-header-wrap">
        <div className="privacy-header">
          <Link to="/home" className="privacy-brand">
            <span className="privacy-brand-mark" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14263E" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" />
              </svg>
            </span>
            <span className="privacy-brand-text">
              <strong>
                Malik<span>Se</span>
              </strong>
              <small>VERIFIED DIRECT MARKETPLACE · AGHOMESINDIA</small>
            </span>
          </Link>

          <nav aria-label="Privacy navigation" className="privacy-nav">
            <Link to="/home" className="privacy-nav-link">
              Home
            </Link>
            <Link
              to="/privacy-policy"
              className={`privacy-nav-link ${pathname === "/privacy-policy" ? "is-active" : ""}`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/delete-account"
              className={`privacy-nav-link ${pathname === "/delete-account" ? "is-active" : ""}`}
            >
              Delete Account
            </Link>
            <Link to="/search" className="privacy-nav-cta">
              Explore Properties
            </Link>
          </nav>
        </div>
      </header>

      <section className="privacy-hero">
        <div className="privacy-hero-orb" aria-hidden="true" />
        <div className="privacy-hero-capsule" aria-hidden="true" />
        <div className="privacy-hero-inner">
          <span className="privacy-eyebrow">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            {eyebrow}
          </span>
          <h1>{title}</h1>
          {!!lead && <p className="privacy-lead">{lead}</p>}
          {!!meta && <p className="privacy-meta">{meta}</p>}
        </div>
      </section>

      <main className="privacy-main">{children}</main>

      <footer className="privacy-footer-wrap">
        <div className="privacy-footer">
          <div className="privacy-footer-left">
            <strong>
              Malik<span>Se</span>
            </strong>
            <span>Operated by AgHomesIndia · Support: </span>
            <a href={`mailto:${privacyContact}`}>{privacyContact}</a>
          </div>
          <div className="privacy-footer-links">
            <Link to="/privacy-policy">Privacy Policy</Link>
            <Link to="/delete-account">Delete Account</Link>
            <Link to="/home" className="privacy-footer-cta">
              Back to properties →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
