import React, { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import "../web/privacy.css";

export const privacyContact = import.meta.env.VITE_PRIVACY_CONTACT_EMAIL || "support@malikse.example";
export const placeholderContact = privacyContact.endsWith(".example");
export default function PrivacyLayout({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  const shell = useRef<HTMLDivElement>(null);
  const { pathname, hash } = useLocation();
  useEffect(() => {
    document.title = `${pathname === "/privacy-policy" ? "Privacy policy" : "Delete account"} | MalikSe`;
    const target = hash ? document.getElementById(hash.slice(1)) : null;
    if (target) target.scrollIntoView(); else shell.current?.scrollTo(0, 0);
  }, [pathname, hash]);
  return <div className="privacy-shell" ref={shell}>
    <header className="privacy-header"><Link to="/home" className="privacy-brand">Malik<span>Se</span><small>powered by AgHomesIndia</small></Link><nav aria-label="Privacy navigation"><Link to="/privacy-policy">Privacy policy</Link><Link to="/delete-account">Delete account</Link></nav></header>
    <main className="privacy-main"><p className="privacy-eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</main>
    <footer className="privacy-footer"><span>Malikse powered by AgHomesIndia</span><Link to="/home">Back to properties →</Link></footer>
  </div>;
}
