import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { randomUUID } from "@/web/crypto";
import PrivacyLayout, { privacyContact } from "../components/PrivacyLayout";
import api from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";

type FaqCategory =
  | "All"
  | "Buying & Verification"
  | "Posting & KYC"
  | "Account & Privacy"
  | "App & Technical";

interface FaqItem {
  id: string;
  category: Exclude<FaqCategory, "All">;
  question: string;
  answer: string;
}

const FAQ_CATEGORIES: FaqCategory[] = [
  "All",
  "Buying & Verification",
  "Posting & KYC",
  "Account & Privacy",
  "App & Technical",
];

const FAQ_ITEMS: FaqItem[] = [
  {
    id: "how-malikse-works",
    category: "Buying & Verification",
    question: "How does MalikSe verify properties before they go live?",
    answer:
      "Every submitted listing goes through ownership identity verification (KYC) and staff review of submitted land or property documents (such as Khata, Jamabandi, or sale deed) along with GPS parcel coordinates and site visits where applicable. Only approved listings are published as verified properties.",
  },
  {
    id: "zero-brokerage",
    category: "Buying & Verification",
    question: "Is there any hidden broker commission for buyers on MalikSe?",
    answer:
      "No. MalikSe connects buyers directly with property owners and assigns an official MalikSe Advisor or Verifier to guide inspection, document checks, and deal closure without third-party broker fees.",
  },
  {
    id: "report-listing",
    category: "Buying & Verification",
    question: "How do I report an incorrect price, duplicate listing, or suspicious contact?",
    answer:
      "Signed-in users can report a listing directly from the property page or inside the mobile app's Contact Support screen. You can also use the support form below or email support@malikse.in with the listing title, district, and details so our verification team can review and act promptly.",
  },
  {
    id: "post-property-steps",
    category: "Posting & KYC",
    question: "How do I post my plot, house, flat, or commercial space on MalikSe?",
    answer:
      "Sign in to your account, complete KYC verification, and open Post Property. Add your property type, location and GPS map parcel boundary, area and asking price, clear photos, and supporting title documents. If you are working with a specific MalikSe Advisor, you can enter their Advisor ID during submission.",
  },
  {
    id: "kyc-safety",
    category: "Posting & KYC",
    question: "Why is KYC verification required, and how are my documents protected?",
    answer:
      "KYC confirms that only genuine owners, buyers, and authorized representatives submit listings or make offers, preventing real-estate impersonation and fraud. Uploaded ID proofs and title records are encrypted in transit over HTTPS/TLS, restricted strictly to authorized verification staff, and never sold or shared for advertising.",
  },
  {
    id: "approval-time",
    category: "Posting & KYC",
    question: "How long does property verification take after submission?",
    answer:
      "Initial staff review typically takes 24 to 72 business hours once complete documents and photos are attached. If anything needs clarification, the listing returns to you with reviewer notes so you can update and resubmit without losing your draft.",
  },
  {
    id: "delete-account-how",
    category: "Account & Privacy",
    question: "How can I permanently delete my MalikSe account and personal data?",
    answer:
      "You can request permanent deletion anytime inside the Android/iOS app under Profile → Delete account, or on the web via our Self-Service Account Deletion page (/delete-account). Deletion removes your profile, KYC files, saved wishlist, listings, and uploaded photos/PDFs (once any active token-paid deals are closed).",
  },
  {
    id: "privacy-data-policy",
    category: "Account & Privacy",
    question: "Does MalikSe sell personal data or show third-party ads?",
    answer:
      "No. MalikSe does not sell user data, run third-party ad networks, or track users across other apps and websites. Full Data Safety details are published on our Privacy Policy page.",
  },
  {
    id: "app-permissions",
    category: "App & Technical",
    question: "Why does the MalikSe mobile app request Location, Photos/Camera, or Notifications?",
    answer:
      "Location (optional) centers the property map near your selected district and helps owners pin land boundaries. Photos & Camera are requested only when you upload listing pictures or voluntary KYC documents. Push Notifications alert you to inquiry replies and listing status updates. All permissions are optional and can be changed in device Settings.",
  },
  {
    id: "otp-login-help",
    category: "App & Technical",
    question: "I did not receive my login or registration OTP — what should I check?",
    answer:
      "Check that your email address or mobile number has no extra spaces or typos, wait for the 100-second resend timer, and inspect your Spam or Promotions folder for email codes. If you remain locked out, write to support@malikse.in with your registered mobile or email (never share your password or OTP).",
  },
];

const TOPIC_MAP: Record<string, { label: string; apiCategory: string }> = {
  account: { label: "Account Access & Login / OTP", apiCategory: "account" },
  verification: { label: "KYC & Identity Verification", apiCategory: "verification" },
  listing: { label: "Property Listing & Approval", apiCategory: "listing" },
  conversation: { label: "Inquiry & Advisor Conversation", apiCategory: "conversation" },
  technical: { label: "App Bug, Map, or Upload Issue", apiCategory: "other" },
  privacy: { label: "Privacy, Data Safety & Account Deletion", apiCategory: "account" },
};

export default function SupportPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaqId, setOpenFaqId] = useState<string>(FAQ_ITEMS[0].id);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [topic, setTopic] = useState<keyof typeof TOPIC_MAP>("account");
  const [contactInfo, setContactInfo] = useState(user?.email || user?.mobile || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const requestKey = useRef<{ payload: string; id: string } | undefined>(undefined);

  const filteredFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQ_ITEMS.filter((item) => {
      if (selectedCategory !== "All" && item.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [selectedCategory, searchQuery]);

  const copySupportEmail = async () => {
    try {
      await navigator.clipboard.writeText(privacyContact);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2500);
    } catch {
      window.location.href = `mailto:${privacyContact}`;
    }
  };

  const openPrefilledEmail = () => {
    const cleanSubject = subject.trim() || `MalikSe Support: ${TOPIC_MAP[topic].label}`;
    const bodyLines = [
      `Topic: ${TOPIC_MAP[topic].label}`,
      `Contact / Registered Account: ${contactInfo.trim() || user?.email || user?.mobile || "Not provided"}`,
      "",
      message.trim() || "Please describe how our team can help you:",
    ];
    const mailtoUrl = `mailto:${privacyContact}?subject=${encodeURIComponent(cleanSubject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;
    window.location.href = mailtoUrl;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setErrorMessage("");
    setStatusMessage("");

    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (!trimmedSubject || !trimmedMessage) {
      setErrorMessage("Please enter a subject and message describing your request.");
      return;
    }

    if (user && accessToken) {
      setBusy(true);
      try {
        const payload = {
          category: TOPIC_MAP[topic].apiCategory,
          subject: trimmedSubject.slice(0, 100),
          body: trimmedMessage.slice(0, 2000),
        };
        const serialized = JSON.stringify(payload);
        if (requestKey.current?.payload !== serialized) {
          requestKey.current = { payload: serialized, id: randomUUID() };
        }
        const response = await api.post("/support", {
          ...payload,
          requestId: requestKey.current.id,
        });
        requestKey.current = undefined;
        setSubject("");
        setMessage("");
        setStatusMessage(
          `Support request submitted (#${String(response.data?._id || "received").slice(-8)}). Our team will reply in your in-app Support inbox or at ${privacyContact}.`,
        );
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status && err.response.status < 500 && err.response.status !== 404) {
          setErrorMessage(err.response.data?.message || "Could not submit your request. You can email us directly below.");
        } else {
          openPrefilledEmail();
          setStatusMessage(`Opening your email app addressed to ${privacyContact} with your request pre-filled.`);
        }
      } finally {
        setBusy(false);
      }
      return;
    }

    openPrefilledEmail();
    setStatusMessage(
      `Your email app has been opened to send this request to ${privacyContact}. You can also email ${privacyContact} directly anytime.`,
    );
  };

  return (
    <PrivacyLayout
      title="Help & Support Center"
      eyebrow="MALIKSE · HELP & SUPPORT"
      lead="Official customer support for the MalikSe Android & iOS apps and web portal. Search frequently asked questions, manage your account, or contact our team directly."
      meta="Support Hours: Mon – Sat, 9:00 AM – 7:00 PM IST · Target Response: Within 24–48 Hours"
    >
      {/* Top Direct Contact & Verification Channels Summary */}
      <section className="policy-summary-card" aria-label="Official Support Channels">
        <div className="policy-summary-top">
          <h2>Direct Support Channels</h2>
          <span className="policy-verified-pill">Active Help Desk · Bihar &amp; Pan-India Support</span>
        </div>

        <div className="policy-highlights-grid">
          <div className="policy-highlight-box">
            <span>Email Support</span>
            <strong>{privacyContact}</strong>
            <p>Account recovery, listing verification, KYC checks, and app store compliance inquiries.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Working Hours</span>
            <strong>Mon – Sat · 9 AM – 7 PM IST</strong>
            <p>Requests are acknowledged within 24–48 business hours.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Corporate Office</span>
            <strong>Patna, Bihar 801503</strong>
            <p>AgHomesIndia, 4th Floor, Om Ganga Complex, Saguna Danapur Station Road.</p>
          </div>
          <div className="policy-highlight-box">
            <span>Self-Service</span>
            <strong>Privacy &amp; Deletion</strong>
            <p>Instant access to <Link to="/delete-account">Account Deletion</Link> and our <Link to="/privacy-policy">Privacy Policy</Link>.</p>
          </div>
        </div>
      </section>

      {/* Interactive Frequently Asked Questions Section */}
      <section className="support-section-card" id="faq" aria-label="Frequently Asked Questions">
        <div className="support-faq-header">
          <div>
            <h2>Frequently Asked Questions</h2>
            <p className="support-subtext">
              Clear answers on property verification, zero brokerage, KYC safety, permissions, and account control.
            </p>
          </div>

          <div className="support-search-wrap">
            <span className="support-search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              className="support-search-input"
              aria-label="Search frequently asked questions"
              placeholder="Search FAQs (KYC, OTP, brokerage)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="support-tabs" role="tablist" aria-label="FAQ categories">
          {FAQ_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              role="tab"
              aria-selected={selectedCategory === category}
              className={`support-tab ${selectedCategory === category ? "is-active" : ""}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        {filteredFaqs.length === 0 ? (
          <div className="support-faq-empty">
            No matching questions found for &ldquo;{searchQuery}&rdquo;. Try another keyword or message us directly below.
          </div>
        ) : (
          <div className="support-faq-list">
            {filteredFaqs.map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <div key={item.id} className={`support-faq-item ${isOpen ? "is-open" : ""}`}>
                  <button
                    type="button"
                    className="support-faq-trigger"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaqId(isOpen ? "" : item.id)}
                  >
                    <span className="support-faq-qwrap">
                      <span className="support-faq-badge">{item.category}</span>
                      <span className="support-faq-q">{item.question}</span>
                    </span>
                    <span className="support-faq-chevron" aria-hidden="true">⌄</span>
                  </button>
                  {isOpen && (
                    <div className="support-faq-answer">
                      <p>{item.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Support Message Form + Quick Links & Grievance Card */}
      <div className="support-bottom-grid">
        <section className="support-form-card" id="contact-form" aria-label="Send a support message">
          <h2>Send a Support Message</h2>
          <p className="support-subtext">
            {user
              ? `Signed in as ${user.name || user.email || user.mobile}. Your request submits straight to MalikSe Support.`
              : "Need direct help or reviewing our app? Send a pre-filled message to our support team — no login required."}
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="support-topic">Topic</label>
            <select
              id="support-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value as keyof typeof TOPIC_MAP)}
            >
              {Object.entries(TOPIC_MAP).map(([value, entry]) => (
                <option key={value} value={value}>
                  {entry.label}
                </option>
              ))}
            </select>

            <label htmlFor="support-contact">Registered Email or Mobile Number</label>
            <input
              id="support-contact"
              type="text"
              placeholder="e.g. name@example.com or +91 98XXXXXXXX"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
            />

            <label htmlFor="support-subject">Subject</label>
            <input
              id="support-subject"
              type="text"
              required
              maxLength={100}
              placeholder="Brief summary of your question or issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />

            <label htmlFor="support-message">Message</label>
            <textarea
              id="support-message"
              required
              maxLength={2000}
              placeholder="Share details (listing ID/district, device model, or steps). Never share passwords or OTPs."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />

            <div className="support-form-actions">
              <button type="submit" className="support-btn-primary" disabled={busy}>
                {busy
                  ? "Submitting…"
                  : user
                    ? "Submit Support Ticket →"
                    : `Send via Email (${privacyContact}) →`}
              </button>

              <button type="button" className="support-btn-secondary" onClick={copySupportEmail}>
                {copiedEmail ? "Copied support@malikse.in ✓" : `Copy ${privacyContact}`}
              </button>
            </div>
          </form>

          {!!statusMessage && (
            <p className="support-success" role="status">
              {statusMessage}
            </p>
          )}
          {!!errorMessage && (
            <p className="privacy-error" role="alert">
              {errorMessage}
            </p>
          )}
        </section>

        <aside className="support-links-card" aria-label="Account controls and compliance links">
          <h2>Essential Links &amp; Safety</h2>
          <p className="support-subtext">
            Quick navigation for users, property owners, and Google Play / Apple App Store reviewers.
          </p>

          <div className="support-quick-list">
            <Link to="/privacy-policy" className="support-quick-link">
              <div>
                <strong>Privacy Policy &amp; Data Safety</strong>
                <span>Learn what data MalikSe collects and how permissions work.</span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>

            <Link to="/delete-account" className="support-quick-link">
              <div>
                <strong>Account &amp; Data Deletion</strong>
                <span>Permanently delete your account, listings, and KYC files.</span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>

            <Link to="/search" className="support-quick-link">
              <div>
                <strong>Explore Verified Properties</strong>
                <span>Browse geo-tagged plots, homes, flats, and shops across Bihar.</span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>

            <Link to="/login" className="support-quick-link">
              <div>
                <strong>Sign In / Create Account</strong>
                <span>Access saved properties, inquiries, and in-app support tickets.</span>
              </div>
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="support-office-card">
            <h3>Grievance &amp; Store Compliance Contact</h3>
            <p>
              <strong>Operator:</strong> AgHomesIndia (MalikSe Platform)
            </p>
            <p>
              <strong>Support Email:</strong> {privacyContact}
            </p>
            <p>
              <strong>Office Address:</strong> 4th Floor, Om Ganga Complex, Saguna Danapur Station Road, Patna 801503,
              Bihar, India
            </p>
            <p>
              <strong>Security Reminder:</strong> MalikSe staff will never ask for your password, banking PIN, or login
              OTP.
            </p>
          </div>
        </aside>
      </div>
    </PrivacyLayout>
  );
}
