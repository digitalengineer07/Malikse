import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PrivacyLayout, { privacyContact } from "../components/PrivacyLayout";

const TOC_ITEMS = [
  { id: "acceptance", num: "01", label: "Acceptance & eligibility", tag: "AGREEMENT" },
  { id: "platform", num: "02", label: "Platform scope & direct deals", tag: "MARKETPLACE" },
  { id: "accounts", num: "03", label: "Accounts, OTP & KYC rules", tag: "VERIFICATION" },
  { id: "listings", num: "04", label: "Listings & staff review", tag: "STANDARDS" },
  { id: "conduct", num: "05", label: "Permitted & prohibited use", tag: "CONDUCT" },
  { id: "payments", num: "06", label: "Offers, deals & disclaimers", tag: "TRANSACTIONS" },
  { id: "ip", num: "07", label: "Intellectual property & third parties", tag: "RIGHTS" },
  { id: "termination", num: "08", label: "Suspension & account deletion", tag: "TERMINATION" },
  { id: "liability", num: "09", label: "Liability & governing law", tag: "LEGAL" },
  { id: "grievance", num: "10", label: "Grievance contact & updates", tag: "SUPPORT" },
];

export default function TermsAndConditions() {
  const [activeId, setActiveId] = useState<string>("acceptance");

  useEffect(() => {
    const elements = TOC_ITEMS.map((t) => document.getElementById(t.id)).filter(Boolean) as HTMLElement[];
    if (!elements.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((e) => e.isIntersecting);
        if (visible?.target?.id) setActiveId(visible.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0.05 }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <PrivacyLayout
      title="Clear rules. Trusted property deals."
      eyebrow="MALIKSE · TERMS & CONDITIONS"
      lead="These Terms & Conditions govern your access to and use of MalikSe across our Android and iOS mobile apps and website for verified direct real-estate discovery and transactions."
      meta="Effective & Updated: 26 November 2026 · Operator: AgHomesIndia (MalikSe Platform)"
    >
      {/* At-a-Glance Summary Card */}
      <section className="policy-summary-card" aria-label="Terms & Conditions Key Highlights">
        <div className="policy-summary-top">
          <h2>Terms at a Glance</h2>
        </div>

        <div className="policy-highlights-grid">
          <div className="policy-highlight-box">
            <span>Eligibility</span>
            <strong>18+ Adults Only</strong>
            <p>Users must be at least 18 years old and legally competent to contract under Indian law.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Marketplace</span>
            <strong>Direct Zero-Broker</strong>
            <p>Connects owners and buyers directly with assigned MalikSe Advisors and Verifiers.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Due Diligence</span>
            <strong>Verified, Not Advice</strong>
            <p>Staff checks help prevent fraud; parties must still complete independent legal due diligence.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Control</span>
            <strong>Transparent Rights</strong>
            <p>Report inaccurate listings or chats anytime, or permanently delete your account anytime.</p>
          </div>
        </div>

        <div className="policy-table-wrap">
          <table className="policy-table">
            <thead>
              <tr>
                <th>Participant / Area</th>
                <th>Key Responsibility</th>
                <th>Platform Safeguard</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Buyers &amp; Visitors</strong></td>
                <td>Provide accurate inquiries &amp; offers; inspect title papers before executing sale deeds</td>
                <td>Staff-screened listings, parcel maps, and direct advisor support</td>
              </tr>
              <tr>
                <td><strong>Property Owners</strong></td>
                <td>Submit genuine ownership/KYC records, accurate pricing, and loan/dispute disclosures</td>
                <td>4-stage KYC, title check, site visit &amp; reviewer feedback before publication</td>
              </tr>
              <tr>
                <td><strong>Assigned Staff</strong></td>
                <td>Coordinate verification, property tours, and buyer-owner communication fairly</td>
                <td>Role-based access control and auditable ticket/inquiry logs</td>
              </tr>
              <tr>
                <td><strong>Market Insights</strong></td>
                <td>Informational corridor estimates and MVR reference benchmarks only</td>
                <td>Not financial, tax, investment, or legal counsel</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="privacy-grid">
        <aside className="privacy-toc" aria-label="On this page">
          <strong>On this page</strong>
          {TOC_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={`toc-link ${activeId === item.id ? "is-active" : ""}`}
              onClick={() => setActiveId(item.id)}
            >
              <span className="toc-num">{item.num}</span>
              <span>{item.label}</span>
            </a>
          ))}

          <div className="policy-toc-actions">
            <Link to="/privacy-policy" className="policy-toc-btn">
              Read Privacy Policy →
            </Link>
            <Link to="/support" className="policy-toc-mail">
              Visit Help &amp; Support
            </Link>
          </div>
        </aside>

        <article className="privacy-article">
          <section id="acceptance">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">01</span>
                <h2>Acceptance &amp; eligibility</h2>
              </div>
              <span className="policy-sec-tag">AGREEMENT</span>
            </div>
            <p>
              Welcome to <strong>MalikSe</strong>, a verified real-estate marketplace operated by{" "}
              <strong>AgHomesIndia</strong> (Patna, Bihar, India). By accessing our website or installing and using
              the MalikSe Android or iOS mobile application, you agree to be bound by these Terms &amp; Conditions and
              our <Link to="/privacy-policy">Privacy Policy</Link>.
            </p>
            <p>
              <strong>Minimum age &amp; authority:</strong> MalikSe is strictly intended for adults aged{" "}
              <strong>18 years and older</strong> who are legally competent to enter into binding contracts under the
              Indian Contract Act, 1872. If you submit a property listing on behalf of a co-owner, family member, or
              organization, you represent that you hold valid written authorization to do so.
            </p>
          </section>

          <section id="platform">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">02</span>
                <h2>Platform scope &amp; direct deals</h2>
              </div>
              <span className="policy-sec-tag">MARKETPLACE</span>
            </div>
            <p>
              MalikSe provides digital tools to discover plots, houses, apartments, and commercial properties across
              Bihar, verify owner identity and revenue documents, pin GPS parcel boundaries, and communicate with
              assigned MalikSe Advisors and Verifiers without third-party brokerage fees.
            </p>
            <p>
              <strong>Platform role:</strong> MalikSe acts as a technology and verification intermediary facilitating
              transparent owner-to-buyer discovery. AgHomesIndia is not a bank, NBFC, escrow agent, government revenue
              authority, or legal title insurer, and does not take custody of property sale proceeds inside the app.
            </p>
          </section>

          <section id="accounts">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">03</span>
                <h2>Accounts, OTP &amp; KYC rules</h2>
              </div>
              <span className="policy-sec-tag">VERIFICATION</span>
            </div>
            <p>
              You may browse public listings as a guest without signing in. To save properties across devices, post a
              property, submit offers, upload KYC documents, or message staff, you must register using a valid
              10-digit mobile number or email address, password, and one-time passcode (OTP).
            </p>
            <ul>
              <li>Keep your password and verification OTPs confidential; MalikSe staff will never ask for them.</li>
              <li>Provide true, current identity details and genuine ownership or KYC documents (such as government ID, Khata, Khesra, Jamabandi, LPC, Registry, or Mutation records).</li>
              <li>You are responsible for all activity occurring under your authenticated account unless you promptly report unauthorized access to <a href={`mailto:${privacyContact}`}>{privacyContact}</a>.</li>
            </ul>
          </section>

          <section id="listings">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">04</span>
                <h2>Listings &amp; staff review</h2>
              </div>
              <span className="policy-sec-tag">STANDARDS</span>
            </div>
            <p>
              Every submitted listing passes through MalikSe staff review before going live, including identity review,
              document screening, location/GPS parcel checks, and site visit checks where applicable.
            </p>
            <p>
              <strong>Mandatory disclosures &amp; moderation:</strong> Property owners must honestly disclose asking
              price, negotiable status, area measurements, possession status, and whether the property has any existing
              loan or legal dispute. MalikSe reserves the right to request corrections, reject, unpublish, or remove any
              listing that contains misleading pricing, unverified claims, duplicate uploads, or incomplete records.
            </p>
          </section>

          <section id="conduct">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">05</span>
                <h2>Permitted &amp; prohibited use</h2>
              </div>
              <span className="policy-sec-tag">CONDUCT</span>
            </div>
            <p>
              All users must act respectfully and lawfully across property submissions, inquiries, and support tickets.
              You can report any suspicious listing or conversation directly using the in-app flag buttons or via our{" "}
              <Link to="/support">Help &amp; Support Center</Link>.
            </p>

            <div className="policy-del-grid">
              <div className="policy-del-box is-clean">
                <strong>Permitted Use</strong>
                <ul>
                  <li>Searching verified homes, flats, plots &amp; commercial spaces</li>
                  <li>Listing genuine owned or authorized properties with accurate records</li>
                  <li>Exchanging respectful property inquiries and genuine offers</li>
                  <li>Reporting inaccurate prices, duplicates, or suspicious activity</li>
                </ul>
              </div>
              <div className="policy-del-box is-retained">
                <strong>Strictly Prohibited</strong>
                <ul>
                  <li>Uploading forged deeds, fake ID proofs, or unauthorized listings</li>
                  <li>Posting abusive, harassing, defamatory, or obscene messages/media</li>
                  <li>Scraping, reverse engineering, or bypassing API rate/auth controls</li>
                  <li>Bypassing verification flows or creating spam/impersonation accounts</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="payments">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">06</span>
                <h2>Offers, deals &amp; disclaimers</h2>
              </div>
              <span className="policy-sec-tag">TRANSACTIONS</span>
            </div>
            <p>
              Offers and deal stages recorded inside MalikSe help coordinate transparent negotiation between buyers,
              owners, and assigned staff. A digital offer or status update does not constitute a registered conveyance
              deed under the Transfer of Property Act or the Registration Act.
            </p>
            <p>
              <strong>Independent due diligence:</strong> While MalikSe performs structured verification checks, buyers
              and sellers remain solely responsible for verifying original title deeds, encumbrance certificates,
              circle office mutations, measurements, and applicable stamp duty or taxes with qualified legal counsel
              prior to paying any token or consideration outside the app.
            </p>
            <p>
              <strong>Market Insights &amp; MVR references:</strong> Corridor pricing trends and indicative MVR rates in
              Market Insights are provided purely for general informational comparison and should not be relied upon as
              certified valuations or investment advice.
            </p>
          </section>

          <section id="ip">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">07</span>
                <h2>Intellectual property &amp; third parties</h2>
              </div>
              <span className="policy-sec-tag">RIGHTS</span>
            </div>
            <p>
              All MalikSe trademarks, logos, software, map interfaces, UI design, and editorial content belong to
              AgHomesIndia or its licensors. By uploading property photos, descriptions, or media you grant AgHomesIndia
              a non-exclusive license to display, format, and promote the listing on MalikSe services while it remains
              active. Private KYC and supporting title PDFs remain access-restricted per our{" "}
              <Link to="/privacy-policy">Privacy Policy</Link>.
            </p>
            <p>
              Maps and directions integrate third-party services such as Google Maps and OpenStreetMap/Leaflet. Your use
              of embedded map views or external links is also subject to those providers&apos; applicable terms.
            </p>
          </section>

          <section id="termination">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">08</span>
                <h2>Suspension &amp; account deletion</h2>
              </div>
              <span className="policy-sec-tag">TERMINATION</span>
            </div>
            <p>
              You may stop using MalikSe or permanently delete your account anytime inside the app under{" "}
              <strong>Profile → Delete account</strong> or via our web{" "}
              <Link to="/delete-account">Account Deletion Portal</Link>. If you have an accepted or token-paid active
              deal, access is disabled immediately while assigned staff close or cancel the deal prior to final data
              cleanup.
            </p>
            <p>
              AgHomesIndia reserves the right to suspend or terminate accounts that violate these Terms, submit
              fraudulent documents, or pose a security or legal risk to other users.
            </p>
          </section>

          <section id="liability">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">09</span>
                <h2>Liability &amp; governing law</h2>
              </div>
              <span className="policy-sec-tag">LEGAL</span>
            </div>
            <p>
              MalikSe services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the
              maximum extent permitted by Indian law, AgHomesIndia and its officers, advisors, and staff shall not be
              liable for any indirect, incidental, consequential, or special damages, loss of profits, or off-platform
              disputes arising between buyers and sellers.
            </p>
            <p>
              These Terms &amp; Conditions are governed by the laws of <strong>India</strong>, and any disputes
              arising out of or relating to MalikSe shall be subject to the exclusive jurisdiction of the competent
              courts in <strong>Patna, Bihar, India</strong>.
            </p>
          </section>

          <section id="grievance" className="policy-contact-banner">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">10</span>
                <h2>Grievance contact &amp; updates</h2>
              </div>
              <span className="policy-sec-tag">SUPPORT</span>
            </div>
            <p>
              <strong>Operator:</strong> AgHomesIndia (MalikSe Platform) ·{" "}
              <strong>Office:</strong> 4th Floor, Om Ganga Complex, Saguna Danapur Station Road, Patna 801503, Bihar,
              India
            </p>
            <p>
              For questions about these Terms, listing takedowns, user reports, or compliance inquiries, email{" "}
              <strong>{privacyContact}</strong> or submit a ticket through our{" "}
              <Link to="/support">Help &amp; Support Center</Link>. We may revise these Terms from time to time and
              will update the effective date above whenever changes take effect.
            </p>
            <a href={`mailto:${privacyContact}`} className="policy-contact-cta">
              Contact Compliance Team ({privacyContact}) →
            </a>
          </section>
        </article>
      </div>
    </PrivacyLayout>
  );
}
