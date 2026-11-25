import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PrivacyLayout, { privacyContact, placeholderContact } from "../components/PrivacyLayout";

const TOC_ITEMS = [
  { id: "overview", num: "01", label: "App overview & scope", tag: "IDENTITY" },
  { id: "information", num: "02", label: "Information we collect", tag: "DATA COLLECTED" },
  { id: "permissions", num: "03", label: "Device permissions (iOS & Android)", tag: "PERMISSIONS" },
  { id: "use", num: "04", label: "How we use information", tag: "PURPOSE" },
  { id: "sharing", num: "05", label: "Sharing & third-party services", tag: "DISCLOSURES" },
  { id: "storage", num: "06", label: "Storage, retention & security", tag: "SECURITY" },
  { id: "choices", num: "07", label: "Your rights & choices", tag: "USER RIGHTS" },
  { id: "deletion", num: "08", label: "Account & data deletion", tag: "DELETION" },
  { id: "children", num: "09", label: "Children's privacy", tag: "18+ POLICY" },
  { id: "contact", num: "10", label: "Contact & policy updates", tag: "SUPPORT" },
];

export default function PrivacyPolicy() {
  const [activeId, setActiveId] = useState<string>("overview");

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
      title="Your information. Your choices."
      eyebrow="MALIKSE · PRIVACY POLICY"
      lead="This Privacy Policy explains how MalikSe (mobile apps for Android & iOS and our website) collects, uses, protects, and deletes personal data for verified direct property transactions."
      meta="Effective & Updated: 25 November 2026 · Operator: AgHomesIndia (MalikSe)"
    >
      {placeholderContact && (
        <aside className="privacy-notice">
          Notice: Set VITE_PRIVACY_CONTACT_EMAIL to override the contact address.
        </aside>
      )}

      {/* Store Reviewer & User At-a-Glance Summary Card */}
      <section className="policy-summary-card" aria-label="App Privacy and Data Safety Summary">
        <div className="policy-summary-top">
          <h2>Data Practices Overview</h2>
        </div>

        <div className="policy-highlights-grid">
          <div className="policy-highlight-box">
            <span>Purpose</span>
            <strong>Verified Real Estate</strong>
            <p>Direct owner-to-buyer property discovery, revenue record verification, and advisor-guided chat.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Advertising</span>
            <strong>No Ad Tracking</strong>
            <p>Zero third-party ad networks, zero cross-app tracking, and no sale of personal data.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Security</span>
            <strong>Encrypted in Transit</strong>
            <p>HTTPS/TLS encryption, hashed passwords, role-based access, and secure mobile token storage.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Control</span>
            <strong>In-App &amp; Web Deletion</strong>
            <p>Self-service account &amp; data deletion inside the app and on our dedicated web form.</p>
          </div>
        </div>

        <div className="policy-table-wrap">
          <table className="policy-table">
            <thead>
              <tr>
                <th>Data Category</th>
                <th>Examples Collected</th>
                <th>Core App Purpose</th>
                <th>Sold or Used for Ads?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Contact &amp; Account Info</strong></td>
                <td>Name, mobile number, email address, encrypted password hash, role</td>
                <td>Account registration, OTP verification, login &amp; advisor/client assignment</td>
                <td>No</td>
              </tr>
              <tr>
                <td><strong>Voluntary KYC &amp; Ownership Docs</strong></td>
                <td>Government ID / selfie (when submitted for KYC), Jamabandi / deed files</td>
                <td>Mandatory identity &amp; title verification to prevent real-estate fraud</td>
                <td>No</td>
              </tr>
              <tr>
                <td><strong>Location &amp; Property Coordinates</strong></td>
                <td>Approximate/precise device location (optional), map parcel coordinates</td>
                <td>Centering property map search &amp; pinning verified listing boundaries</td>
                <td>No</td>
              </tr>
              <tr>
                <td><strong>User-Generated Content</strong></td>
                <td>Property listings, photos, offer prices, advisor/buyer messages</td>
                <td>Publishing verified listings, negotiation &amp; transaction tracking</td>
                <td>No</td>
              </tr>
              <tr>
                <td><strong>Diagnostics &amp; App Activity</strong></td>
                <td>Search filters, saved properties, push token, basic request logs</td>
                <td>Wishlist sync, delivery of enquiry alerts, security &amp; crash diagnostics</td>
                <td>No</td>
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
            <Link to="/delete-account" className="policy-toc-btn">
              Delete Account &amp; Data →
            </Link>
            <a href={`mailto:${privacyContact}`} className="policy-toc-mail">
              Email {privacyContact}
            </a>
          </div>
        </aside>

        <article className="privacy-article">
          <section id="overview">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">01</span>
                <h2>App overview &amp; scope</h2>
              </div>
              <span className="policy-sec-tag">IDENTITY</span>
            </div>
            <p>
              <strong>MalikSe</strong> (available on Android, iOS, and the web) is operated by{" "}
              <strong>AgHomesIndia</strong>. MalikSe is a verified owner-to-buyer real estate marketplace serving buyers,
              property owners, field verifiers, and advisors across Bihar, India.
            </p>
            <p>
              This Privacy Policy applies across the MalikSe Android application, iOS application, and official website,
              and explains exactly what data is processed when you browse listings, verify your identity, post properties,
              communicate with assigned staff, or delete your account.
            </p>
          </section>

          <section id="information">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">02</span>
                <h2>Information we collect</h2>
              </div>
              <span className="policy-sec-tag">DATA COLLECTED</span>
            </div>
            <p>
              <strong>Account &amp; profile details:</strong> your full name, 10-digit mobile number, email address
              (optional or primary depending on sign-up method), password hash, account role (user, owner, advisor,
              verifier), and verification status. When you use Google Sign-In, we receive your Google name, email
              address, and verification token. We also process temporary one-time passcodes (OTP) for account
              registration and password recovery.
            </p>
            <p>
              <strong>Voluntary KYC &amp; identity verification documents:</strong> if you choose to verify your identity
              to list properties or unlock verified features, we collect the identity documents you upload along with
              staff review outcomes and timestamps. Sensitive KYC files are access-restricted and never displayed
              publicly.
            </p>
            <p>
              <strong>Property listings &amp; supporting records:</strong> listing titles, descriptions, asking prices,
              land dimensions, district/mouza location, GPS polygon coordinates, uploaded photographs, and supporting
              revenue/title records (such as Jamabandi, Khatiyan, or LPC documents) submitted for staff review.
            </p>
            <p>
              <strong>Messages, offers &amp; advisor interactions:</strong> enquiries, price offers, counter-offers,
              deal stage milestones, advisor assignment IDs, and chat messages exchanged inside property threads.
            </p>
            <p>
              <strong>Activity &amp; technical storage:</strong> saved wishlist items, recent search filters, property
              view/interaction history for discovery ranking, push notification tokens, and standard device/network
              diagnostics (such as app version and IP address for rate-limiting and fraud defense). On mobile devices,
              authentication tokens are stored in encrypted native device storage (<code>expo-secure-store</code>). On
              the web, refresh sessions use secure <code>HttpOnly</code> cookies alongside browser session storage.
            </p>
          </section>

          <section id="permissions">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">03</span>
                <h2>Device permissions (iOS &amp; Android)</h2>
              </div>
              <span className="policy-sec-tag">PERMISSIONS</span>
            </div>
            <p>
              MalikSe requests system permissions only when needed for an active user feature, and you can revoke any
              permission at any time from your iOS or Android system settings:
            </p>
            <div className="policy-perm-grid">
              <div className="policy-perm-card">
                <span>Optional · When In Use</span>
                <strong>Location Services</strong>
                <p>
                  Centers map searches on nearby verified properties and helps owners drop accurate land pins. Never
                  tracked in the background.
                </p>
              </div>
              <div className="policy-perm-card">
                <span>Optional · On Action</span>
                <strong>Photos &amp; Documents</strong>
                <p>
                  Used solely when you pick property photos, ownership deeds, or voluntary KYC documents to upload. No
                  background scanning.
                </p>
              </div>
              <div className="policy-perm-card">
                <span>Optional · Alerts</span>
                <strong>Push Notifications</strong>
                <p>
                  Sends real-time updates for property approvals, client inquiries, advisor assignments, and deal
                  messages.
                </p>
              </div>
            </div>
          </section>

          <section id="use">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">04</span>
                <h2>How we use information</h2>
              </div>
              <span className="policy-sec-tag">PURPOSE</span>
            </div>
            <p>We process your personal information strictly for legitimate service operations:</p>
            <ul>
              <li>Authenticating accounts, issuing OTPs, and preventing unauthorized access or spam accounts.</li>
              <li>Performing human and legal due diligence (KYC checks and land-record verification) before listings go live.</li>
              <li>Connecting property owners, buyers, and their assigned MalikSe advisor for guided, zero-brokerage deals.</li>
              <li>Operating interactive property maps, district/budget filters, saved wishlists, and personal recommendations.</li>
              <li>Sending essential transactional alerts (verification status, enquiry notifications, offer updates).</li>
              <li>Maintaining audit trails required for active property negotiations, security monitoring, and dispute resolution.</li>
            </ul>
            <p>
              <strong>No sale of data &amp; no third-party ad tracking:</strong> MalikSe never sells, rents, or trades
              personal data, and never uses your data for cross-app behavioral advertising.
            </p>
          </section>

          <section id="sharing">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">05</span>
                <h2>Sharing &amp; third-party services</h2>
              </div>
              <span className="policy-sec-tag">DISCLOSURES</span>
            </div>
            <p>
              <strong>Public vs. private visibility:</strong> Verified and published property details (photos, price,
              property specs, general district/map pin) are visible to marketplace visitors. Your personal contact
              details, private KYC files, draft listings, and supporting title PDFs are strictly gated by server-side
              authentication and role-based access control.
            </p>
            <p>
              <strong>Assigned staff &amp; transaction participants:</strong> Authorized MalikSe administrators,
              verifiers, and the advisor assigned to a property can review submitted documents and coordinate deal
              messages. Direct offers and chats are visible only to participating parties and assigned staff.
            </p>
            <p>
              <strong>Service &amp; infrastructure processors:</strong> We rely on trusted providers solely to run core
              functionality: cloud hosting &amp; encrypted database storage, SMS/OTP delivery (e.g., Twilio),
              transactional SMTP email delivery, Google OAuth (when chosen for Sign-In), push notification relays (Expo),
              and interactive map tile providers (Google Maps / OpenStreetMap-Leaflet). Requests to map tile providers
              transmit your IP address and requested map viewport coordinates solely to render map imagery.
            </p>
            <p>
              <strong>Legal compliance:</strong> Information may be disclosed if required by applicable Indian law,
              court order, or law enforcement request, or to investigate fraud and enforce our terms.
            </p>
          </section>

          <section id="storage">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">06</span>
                <h2>Storage, retention &amp; security</h2>
              </div>
              <span className="policy-sec-tag">SECURITY</span>
            </div>
            <p>
              We protect data using HTTPS/TLS encryption in transit, salted bcrypt/cryptographic password hashing,
              short-lived access tokens, <code>HttpOnly</code> refresh cookies on web, hardware-backed secure storage on
              mobile, and strict server-side role checks on all private media/document routes. While no internet service
              can guarantee 100% immunity from every risk, we continuously audit access controls and upload limits.
            </p>
            <p>
              <strong>Data retention schedule:</strong>
            </p>
            <ul>
              <li>
                <strong>Active accounts &amp; listings:</strong> retained as long as your account remains active or as
                needed to provide marketplace services.
              </li>
              <li>
                <strong>Discovery engagement logs:</strong> automated discovery/interaction events automatically expire
                after approximately <strong>30 days</strong>.
              </li>
              <li>
                <strong>OTP &amp; verification codes:</strong> temporary codes expire automatically within minutes of
                issuance.
              </li>
              <li>
                <strong>Encrypted infrastructure backups:</strong> automated server and database backups overwrite on a
                rolling <strong>30 to 90 day</strong> retention cycle and remain encrypted until purged.
              </li>
              <li>
                <strong>Deletion audit receipts:</strong> non-personal status receipts issued after deletion remain
                verifiable for up to <strong>90 days</strong> without retaining deleted contact details.
              </li>
            </ul>
          </section>

          <section id="choices">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">07</span>
                <h2>Your rights &amp; choices</h2>
              </div>
              <span className="policy-sec-tag">USER RIGHTS</span>
            </div>
            <p>
              Under applicable data-protection principles (including India&apos;s Digital Personal Data Protection Act,
              2023), you have the right to:
            </p>
            <ul>
              <li>Browse public verified property listings without creating an account.</li>
              <li>Review and update your profile details and saved properties inside your account settings.</li>
              <li>Enable or revoke device location, media access, or push notification permissions anytime.</li>
              <li>Sign out on any device or permanently delete your account and associated personal data.</li>
              <li>Raise privacy questions, correction requests, or grievances with our support team.</li>
            </ul>
          </section>

          <section id="deletion">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">08</span>
                <h2>Account &amp; data deletion</h2>
              </div>
              <span className="policy-sec-tag">SELF-SERVICE DELETION</span>
            </div>
            <p>
              You can permanently delete your MalikSe account and associated data directly from{" "}
              <strong>Profile → Delete account</strong> inside the mobile app, or anytime from our web{" "}
              <Link to="/delete-account">Account Deletion Portal</Link> (no app install required).
            </p>

            <div className="policy-del-grid">
              <div className="policy-del-box is-clean">
                <strong>Permanently Deleted</strong>
                <ul>
                  <li>Account profile, mobile/email &amp; password credentials</li>
                  <li>Submitted KYC identity documents &amp; review history</li>
                  <li>Owned property listings, photos &amp; PDF files</li>
                  <li>Saved wishlists, preferences, push tokens &amp; chats</li>
                  <li>Open, unaccepted buyer/seller offers</li>
                </ul>
              </div>
              <div className="policy-del-box is-retained">
                <strong>Narrow Statutory / Deal Exceptions</strong>
                <ul>
                  <li>Active accepted or token-paid deals wait for staff closure while account login stays disabled</li>
                  <li>Counterparty deal amounts/dates remain with your identity stripped &amp; anonymized</li>
                  <li>Encrypted server backups purge automatically on rolling 30–90 day cycle</li>
                </ul>
              </div>
            </div>

            <Link to="/delete-account" className="policy-del-cta">
              Open Account Deletion Form →
            </Link>
          </section>

          <section id="children">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">09</span>
                <h2>Children&apos;s privacy</h2>
              </div>
              <span className="policy-sec-tag">18+ POLICY</span>
            </div>
            <p>
              MalikSe is designed for adults aged <strong>18 years and older</strong> to buy, sell, or enquire about
              real estate properties. We do not knowingly solicit or collect personal information from anyone under 18
              years of age. If you believe a minor has submitted personal data without guardian consent, please email{" "}
              <a href={`mailto:${privacyContact}`}>{privacyContact}</a> so we can promptly remove the information.
            </p>
          </section>

          <section id="contact" className="policy-contact-banner">
            <div className="policy-sec-head">
              <div className="policy-sec-title-wrap">
                <span className="policy-sec-num">10</span>
                <h2>Contact &amp; policy updates</h2>
              </div>
              <span className="policy-sec-tag">PRIVACY SUPPORT</span>
            </div>
            <p>
              <strong>Data Controller / Operator:</strong> MalikSe powered by AgHomesIndia
            </p>
            <p>
              For privacy questions, data-access requests, grievance redressal, or app store verification inquiries,
              contact our dedicated privacy team at <strong>{privacyContact}</strong>. We target initial acknowledgement
              within 48 hours. Never send passwords, verification OTPs, or KYC files over unencrypted email.
            </p>
            <p>
              We update this page whenever platform practices change and display the latest effective date above.
            </p>
            <a href={`mailto:${privacyContact}`} className="policy-contact-cta">
              Contact Privacy Team ({privacyContact}) →
            </a>
          </section>
        </article>
      </div>
    </PrivacyLayout>
  );
}
