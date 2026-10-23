import React, { useState, useMemo } from "react";
import {
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Modal,
  Platform,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import type { Listing } from "../src/services/workflowService";
import AppHeader from "./AppHeader";
import VerifiedPropertyMap from "./VerifiedPropertyMap";

interface PublicPropertyDetailsProps {
  property: Listing;
  onOffer: () => void;
  canOffer: boolean;
  isSaved?: boolean;
  onToggleSave?: () => void;
  children: React.ReactNode;
}

export default function PublicPropertyDetails({
  property: p,
  onOffer,
  canOffer,
  isSaved,
  onToggleSave,
  children,
}: PublicPropertyDetailsProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isDesktop = width >= 980;

  const [activePhoto, setActivePhoto] = useState(0);
  const [linkError, setLinkError] = useState("");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [galleryExpanded, setGalleryExpanded] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const photos = useMemo(() => {
    return (p.media?.photos || []).map((uri) => ({ uri }));
  }, [p.media?.photos]);

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() =>
      setLinkError("Could not open this link. Please try again.")
    );
  };

  const handleShare = () => {
    if (typeof window !== "undefined" && window.location) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      } else if (navigator.share) {
        navigator.share({
          title: p.title || `${p.type} in ${p.location.district}`,
          url: window.location.href,
        }).catch(() => {});
      }
    }
  };

  // Calculated metrics
  const effectiveArea = p.sellableArea || p.totalArea || 0;
  const ratePerSqFt =
    effectiveArea > 0 ? Math.round(p.price / effectiveArea) : null;
  const estimatedEMI = Math.round(p.price * 0.00868); // ~8.5% interest, 20-year tenure

  const formattedDistrict = p.location.district || "Bihar";
  const formattedMauza = p.location.mauza || p.location.block || "Verified Hub";
  const fullAddress = [
    p.location.mauza,
    p.location.block,
    p.location.district,
    p.location.state,
    p.location.pincode ? `PIN ${p.location.pincode}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={styles.screen}>
      {/* Top Application Header */}
      <AppHeader showBack fallbackRoute="/search" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isDesktop ? 60 : 100 },
        ]}
      >
        <View style={styles.mainContainer}>
          {/* Top Breadcrumb Navigation & Share Strip */}
          <View style={styles.breadcrumbBar}>
            <View style={styles.breadcrumbLeft}>
              <TouchableOpacity
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/search"))}
                style={styles.breadcrumbLink}
              >
                <MaterialIcons name="explore" size={14} color="#0284C7" />
                <Text style={styles.breadcrumbLinkText}>Explore Map</Text>
              </TouchableOpacity>
              <MaterialIcons name="chevron-right" size={14} color="#94A3B8" />
              <Text style={styles.breadcrumbItem}>{p.location.state || "Bihar"}</Text>
              <MaterialIcons name="chevron-right" size={14} color="#94A3B8" />
              <Text style={styles.breadcrumbItem}>{formattedDistrict}</Text>
              <MaterialIcons name="chevron-right" size={14} color="#94A3B8" />
              <Text style={[styles.breadcrumbItem, styles.breadcrumbActive]} numberOfLines={1}>
                {formattedMauza}
              </Text>
            </View>

            <View style={styles.breadcrumbRight}>
              <TouchableOpacity
                onPress={handleShare}
                style={styles.actionIconButton}
                accessibilityLabel="Share property listing"
              >
                <MaterialIcons
                  name={copiedLink ? "check" : "share"}
                  size={17}
                  color={copiedLink ? "#059669" : "#03456C"}
                />
                <Text style={[styles.actionIconText, copiedLink && { color: "#059669" }]}>
                  {copiedLink ? "Copied!" : "Share"}
                </Text>
              </TouchableOpacity>

              {onToggleSave && (
                <TouchableOpacity
                  onPress={onToggleSave}
                  style={[styles.actionIconButton, isSaved && styles.actionIconButtonSaved]}
                  accessibilityLabel="Save property"
                >
                  <MaterialIcons
                    name={isSaved ? "favorite" : "favorite-border"}
                    size={18}
                    color={isSaved ? "#E11D48" : "#03456C"}
                  />
                  <Text style={[styles.actionIconText, isSaved && { color: "#E11D48" }]}>
                    {isSaved ? "Saved" : "Save"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Hero Media Showcase / Gallery */}
          <View style={styles.heroSection}>
            <View style={[styles.heroMainPhoto, { height: isDesktop ? 450 : 290 }]}>
              {photos[activePhoto] ? (
                <Image
                  source={photos[activePhoto]}
                  style={StyleSheet.absoluteFill}
                  resizeMode="cover"
                  accessibilityLabel={`Property photo ${activePhoto + 1}`}
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <MaterialIcons name="landscape" size={72} color="#94A3B8" />
                  <Text style={styles.placeholderTitle}>Verified Property Media</Text>
                  <Text style={styles.placeholderSubtitle}>
                    Demarcated parcel registered under MalikSe records
                  </Text>
                </View>
              )}

              {/* Floating Verified Trust Badge */}
              <View style={styles.heroVerifiedBadge}>
                <MaterialIcons name="verified" size={17} color="#059669" />
                <Text style={styles.heroVerifiedText}>MalikSe Verified</Text>
              </View>

              {/* Category Pill */}
              <View style={styles.heroTypeBadge}>
                <Text style={styles.heroTypeText}>{p.type.toUpperCase()}</Text>
              </View>

              {/* Carousel Arrows (if multiple photos) */}
              {photos.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.carouselArrow, styles.carouselArrowLeft]}
                    onPress={() =>
                      setActivePhoto((activePhoto + photos.length - 1) % photos.length)
                    }
                    accessibilityLabel="Previous photo"
                  >
                    <MaterialIcons name="chevron-left" size={26} color="#0F172A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.carouselArrow, styles.carouselArrowRight]}
                    onPress={() => setActivePhoto((activePhoto + 1) % photos.length)}
                    accessibilityLabel="Next photo"
                  >
                    <MaterialIcons name="chevron-right" size={26} color="#0F172A" />
                  </TouchableOpacity>

                  {/* Photo Counter Pill */}
                  <View style={styles.photoCountBadge}>
                    <MaterialIcons name="photo-camera" size={14} color="#FFFFFF" />
                    <Text style={styles.photoCountText}>
                      {activePhoto + 1} / {photos.length}
                    </Text>
                  </View>
                </>
              )}

              {/* Fullscreen Expand Button */}
              {photos.length > 0 && (
                <TouchableOpacity
                  style={styles.fullscreenBtn}
                  onPress={() => setGalleryExpanded(true)}
                  accessibilityLabel="View full photo"
                >
                  <MaterialIcons name="fullscreen" size={20} color="#0F172A" />
                </TouchableOpacity>
              )}
            </View>

            {/* Clickable Photo Thumbnails Strip */}
            {photos.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailStrip}
              >
                {photos.map((photoItem, idx) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => setActivePhoto(idx)}
                    style={[
                      styles.thumbnailItem,
                      activePhoto === idx && styles.thumbnailActive,
                    ]}
                  >
                    <Image
                      source={photoItem}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Responsive 2-Column Content Layout */}
          <View style={[styles.layoutRow, isDesktop ? styles.layoutDesktop : styles.layoutMobile]}>
            {/* Left Content Column */}
            <View style={styles.leftColumn}>
              {/* Title & Core Location Header */}
              <View style={styles.card}>
                <View style={styles.titleTopRow}>
                  <View style={styles.statusPills}>
                    <View style={styles.legalCheckPill}>
                      <MaterialIcons name="gavel" size={13} color="#03456C" />
                      <Text style={styles.legalCheckText}>Title Inspected</Text>
                    </View>
                    <View style={styles.directPill}>
                      <MaterialIcons name="person" size={13} color="#059669" />
                      <Text style={styles.directText}>Direct Owner Listing</Text>
                    </View>
                  </View>

                  <Text style={styles.priceHighlight}>
                    ₹{p.price.toLocaleString("en-IN")}
                  </Text>
                </View>

                <Text style={styles.propertyTitle}>
                  {p.title || `${p.type} in ${formattedDistrict}`}
                </Text>

                <View style={styles.locationRow}>
                  <MaterialIcons name="location-on" size={18} color="#0284C7" />
                  <Text style={styles.locationText}>{fullAddress}</Text>
                </View>
              </View>

              {/* Key Highlights Metrics Grid (6 Elevated Stat Cards) */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="dashboard-customize" size={19} color="#03456C" />
                  <Text style={styles.sectionTitle}>Key Property Highlights</Text>
                </View>

                <View style={styles.statsGrid}>
                  {/* Total Area */}
                  <View style={styles.statTile}>
                    <View style={styles.statIconBadge}>
                      <MaterialIcons name="square-foot" size={20} color="#0284C7" />
                    </View>
                    <Text style={styles.statValue}>
                      {p.totalArea != null ? `${p.totalArea.toLocaleString("en-IN")}` : "Demarcated"}
                    </Text>
                    <Text style={styles.statSub}>Total Sq.Ft</Text>
                  </View>

                  {/* Sellable Area */}
                  <View style={styles.statTile}>
                    <View style={styles.statIconBadge}>
                      <MaterialIcons name="crop-free" size={20} color="#0284C7" />
                    </View>
                    <Text style={styles.statValue}>
                      {p.sellableArea != null ? `${p.sellableArea.toLocaleString("en-IN")}` : "Full Area"}
                    </Text>
                    <Text style={styles.statSub}>Sellable Sq.Ft</Text>
                  </View>

                  {/* Rate / Sq.Ft */}
                  <View style={styles.statTile}>
                    <View style={styles.statIconBadge}>
                      <MaterialIcons name="trending-up" size={20} color="#059669" />
                    </View>
                    <Text style={styles.statValue}>
                      {ratePerSqFt ? `₹${ratePerSqFt.toLocaleString("en-IN")}` : "Prime Rate"}
                    </Text>
                    <Text style={styles.statSub}>Rate / Sq.Ft</Text>
                  </View>

                  {/* Property Type */}
                  <View style={styles.statTile}>
                    <View style={styles.statIconBadge}>
                      <MaterialIcons name="apartment" size={20} color="#03456C" />
                    </View>
                    <Text style={styles.statValue}>{p.type}</Text>
                    <Text style={styles.statSub}>Category</Text>
                  </View>

                  {/* Price Terms */}
                  <View style={styles.statTile}>
                    <View style={styles.statIconBadge}>
                      <MaterialIcons name="handshake" size={20} color="#0284C7" />
                    </View>
                    <Text style={styles.statValue}>
                      {p.negotiable ? "Negotiable" : "Fixed Price"}
                    </Text>
                    <Text style={styles.statSub}>Price Terms</Text>
                  </View>

                  {/* Possession */}
                  <View style={styles.statTile}>
                    <View style={styles.statIconBadge}>
                      <MaterialIcons name="vpn-key" size={20} color="#059669" />
                    </View>
                    <Text style={styles.statValue}>
                      {p.disclosures?.possessionStatus || "Immediate"}
                    </Text>
                    <Text style={styles.statSub}>Possession</Text>
                  </View>
                </View>
              </View>

              {/* Property Description Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="description" size={19} color="#03456C" />
                  <Text style={styles.sectionTitle}>Property Overview</Text>
                </View>
                <Text style={styles.descriptionText}>
                  {p.description ||
                    "This verified property is listed under MalikSe authenticated records with physical boundary checks and direct ownership details."}
                </Text>
              </View>

              {/* Land, Dimensions & Spatial Access Specifications */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="straighten" size={19} color="#03456C" />
                  <Text style={styles.sectionTitle}>Land & Spatial Access Details</Text>
                </View>

                <View style={styles.specsTable}>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Boundary & Demarcation</Text>
                    <Text style={styles.specValue}>{p.boundary || "Clearly Demarcated"}</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Approach Road Width</Text>
                    <Text style={styles.specValue}>
                      {p.roadWidth ? `${p.roadWidth} ft wide approach road` : "Connected to Road"}
                    </Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Revenue Mauza</Text>
                    <Text style={styles.specValue}>{p.location.mauza || "Verified Mauza"}</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Block / Circle</Text>
                    <Text style={styles.specValue}>{p.location.block || "District Sadar"}</Text>
                  </View>
                  <View style={styles.specRow}>
                    <Text style={styles.specLabel}>Jurisdiction / Thana</Text>
                    <Text style={styles.specValue}>{p.location.policeStation || "Local Jurisdiction"}</Text>
                  </View>
                  {(p.khata || p.khesra) && (
                    <View style={styles.specRow}>
                      <Text style={styles.specLabel}>Khata & Khesra Records</Text>
                      <Text style={styles.specValue}>
                        Khata: {p.khata || "Recorded"} · Khesra: {p.khesra || "Recorded"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Legal Title & Due Diligence Disclosures */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="security" size={19} color="#03456C" />
                  <Text style={styles.sectionTitle}>Legal Due Diligence & Disclosures</Text>
                </View>

                <View style={styles.disclosuresList}>
                  <View style={styles.disclosureItem}>
                    <View style={styles.disclosureIconCircle}>
                      <MaterialIcons
                        name={p.disclosures?.hasLoan ? "info" : "check-circle"}
                        size={18}
                        color={p.disclosures?.hasLoan ? "#F59E0B" : "#059669"}
                      />
                    </View>
                    <View style={styles.disclosureContent}>
                      <Text style={styles.disclosureTitle}>Bank Loan / Encumbrance</Text>
                      <Text style={styles.disclosureDesc}>
                        {p.disclosures?.hasLoan
                          ? "Existing loan reported by owner. Clearance assistance provided."
                          : "No mortgage or bank encumbrance recorded on property."}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.disclosureItem}>
                    <View style={styles.disclosureIconCircle}>
                      <MaterialIcons
                        name={p.disclosures?.hasDispute ? "warning" : "check-circle"}
                        size={18}
                        color={p.disclosures?.hasDispute ? "#EF4444" : "#059669"}
                      />
                    </View>
                    <View style={styles.disclosureContent}>
                      <Text style={styles.disclosureTitle}>Litigation & Disputes</Text>
                      <Text style={styles.disclosureDesc}>
                        {p.disclosures?.hasDispute
                          ? "Disclosed dispute under legal review."
                          : "100% dispute-free verified title and peaceful possession history."}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.disclosureItem}>
                    <View style={styles.disclosureIconCircle}>
                      <MaterialIcons name="vpn-key" size={18} color="#0284C7" />
                    </View>
                    <View style={styles.disclosureContent}>
                      <Text style={styles.disclosureTitle}>Handover & Possession</Text>
                      <Text style={styles.disclosureDesc}>
                        {p.disclosures?.possessionStatus || "Immediate possession available upon registration."}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Verification Shield Banner */}
                <View style={styles.trustShieldBanner}>
                  <MaterialIcons name="verified-user" size={26} color="#03456C" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trustShieldTitle}>
                      Certified Ground & Legal Verification
                    </Text>
                    <Text style={styles.trustShieldDesc}>
                      On-site GPS coordinates validated and chain-of-title reviewed by certified MalikSe Legal Advisors.
                    </Text>
                  </View>
                </View>
              </View>

              {/* Interactive Geospatial Location & Map Card */}
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <MaterialIcons name="map" size={19} color="#03456C" />
                  <Text style={styles.sectionTitle}>Geographic Location & Map</Text>
                </View>

                {/* Embedded Interactive Map Container */}
                <View style={styles.embeddedMapBox}>
                  <VerifiedPropertyMap
                    properties={[
                      {
                        id: p._id,
                        type: p.type,
                        status: p.status,
                        price: p.price,
                        location: p.location,
                        parcelPoints: p.parcelPoints,
                        title: p.title,
                      },
                    ]}
                    onSelect={() => {}}
                  />
                  <TouchableOpacity
                    style={styles.expandMapFloatingBtn}
                    onPress={() => setMapExpanded(true)}
                    accessibilityLabel="Open map in fullscreen"
                  >
                    <MaterialIcons name="open-in-full" size={16} color="#03456C" />
                    <Text style={styles.expandMapFloatingText}>Fullscreen Map</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.googleMapsBtn}
                  onPress={() =>
                    openLink(
                      `https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`
                    )
                  }
                >
                  <MaterialIcons name="directions" size={18} color="#03456C" />
                  <Text style={styles.googleMapsBtnText}>
                    Get Directions in Google Maps ({p.location.lat.toFixed(4)}, {p.location.lng.toFixed(4)})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Video Tour Links (if available) */}
              {p.media?.videos && p.media.videos.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.sectionHeader}>
                    <MaterialIcons name="videocam" size={19} color="#03456C" />
                    <Text style={styles.sectionTitle}>Property Video Tour</Text>
                  </View>
                  {p.media.videos.map((url, index) => (
                    <TouchableOpacity
                      key={url}
                      accessibilityRole="button"
                      style={styles.videoCard}
                      onPress={() => openLink(url)}
                    >
                      <MaterialIcons name="play-circle-fill" size={28} color="#0284C7" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.videoTitle}>Watch Virtual Video Walkthrough {index + 1}</Text>
                        <Text style={styles.videoSubtitle}>High-definition footage of site and surroundings</Text>
                      </View>
                      <MaterialIcons name="open-in-new" size={16} color="#64748B" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Error Alert or Children modals */}
              {!!linkError && (
                <View style={styles.errorNotice}>
                  <MaterialIcons name="error-outline" size={16} color="#DC2626" />
                  <Text style={styles.errorNoticeText}>{linkError}</Text>
                </View>
              )}

              {children}
            </View>

            {/* Right Sticky Sidebar (Desktop Only) */}
            {isDesktop && (
              <View style={styles.sidebarColumn}>
                <View style={styles.stickyCard}>
                  <View style={styles.sidebarPriceSection}>
                    <Text style={styles.sidebarPriceLabel}>Asking Price</Text>
                    <Text style={styles.sidebarPriceValue}>
                      ₹{p.price.toLocaleString("en-IN")}
                    </Text>
                    <View style={styles.sidebarPriceMetaRow}>
                      {ratePerSqFt && (
                        <View style={styles.sidebarRateBadge}>
                          <Text style={styles.sidebarRateText}>
                            ₹{ratePerSqFt.toLocaleString("en-IN")} / sq.ft
                          </Text>
                        </View>
                      )}
                      <Text style={styles.sidebarPriceTerms}>
                        {p.negotiable ? "• Flexible Pricing" : "• Direct Fixed Price"}
                      </Text>
                    </View>
                  </View>

                  {/* Estimated EMI Pill */}
                  <View style={styles.emiBox}>
                    <MaterialIcons name="calculate" size={16} color="#0284C7" />
                    <Text style={styles.emiText}>
                      Est. EMI: <Text style={styles.emiBold}>₹{estimatedEMI.toLocaleString("en-IN")}</Text>/mo
                    </Text>
                  </View>

                  <View style={styles.sidebarDivider} />

                  {/* Primary CTA: Make an Offer */}
                  {canOffer && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Make an offer on this property"
                      onPress={onOffer}
                      style={styles.primaryCtaBtn}
                      activeOpacity={0.88}
                    >
                      <MaterialIcons name="chat-bubble-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.primaryCtaText}>Make an Offer</Text>
                    </TouchableOpacity>
                  )}

                  {/* Secondary CTA: Get Directions / Site Visit */}
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel="Get directions in Google Maps"
                    onPress={() =>
                      openLink(
                        `https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`
                      )
                    }
                    style={styles.secondaryCtaBtn}
                    activeOpacity={0.85}
                  >
                    <MaterialIcons name="directions" size={18} color="#03456C" />
                    <Text style={styles.secondaryCtaText}>Directions & Site Visit</Text>
                  </TouchableOpacity>

                  {/* Advisor Support Callout */}
                  <View style={styles.advisorCallout}>
                    <View style={styles.advisorAvatar}>
                      <MaterialIcons name="support-agent" size={24} color="#0284C7" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.advisorTitle}>Dedicated Property Advisor</Text>
                      <Text style={styles.advisorDesc}>
                        Need assistance or title deed review? Our Bihar land specialists provide 100% free guidance.
                      </Text>
                    </View>
                  </View>

                  {/* Trust Guarantees */}
                  <View style={styles.sidebarTrustRow}>
                    <View style={styles.sidebarTrustItem}>
                      <MaterialIcons name="check-circle" size={14} color="#059669" />
                      <Text style={styles.sidebarTrustText}>Zero Brokerage</Text>
                    </View>
                    <View style={styles.sidebarTrustItem}>
                      <MaterialIcons name="check-circle" size={14} color="#059669" />
                      <Text style={styles.sidebarTrustText}>Verified Title</Text>
                    </View>
                    <View style={styles.sidebarTrustItem}>
                      <MaterialIcons name="check-circle" size={14} color="#059669" />
                      <Text style={styles.sidebarTrustText}>Direct Owner</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Mobile Floating Bottom Bar */}
      {!isDesktop && canOffer && (
        <View style={[styles.mobileBottomBar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.mobileBottomBarLeft}>
            <Text style={styles.mobilePriceText}>
              ₹{p.price.toLocaleString("en-IN")}
            </Text>
            {ratePerSqFt && (
              <Text style={styles.mobileRateText}>
                ₹{ratePerSqFt.toLocaleString("en-IN")}/sq.ft
              </Text>
            )}
          </View>

          <View style={styles.mobileBottomBarRight}>
            <TouchableOpacity
              onPress={() =>
                openLink(
                  `https://www.google.com/maps/search/?api=1&query=${p.location.lat},${p.location.lng}`
                )
              }
              style={styles.mobileDirectionsBtn}
              accessibilityLabel="Get directions"
            >
              <MaterialIcons name="directions" size={19} color="#03456C" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onOffer}
              style={styles.mobileOfferBtn}
              accessibilityLabel="Make an offer"
            >
              <MaterialIcons name="chat-bubble-outline" size={16} color="#FFFFFF" />
              <Text style={styles.mobileOfferText}>Make Offer</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Fullscreen Map Modal */}
      <Modal
        visible={mapExpanded}
        transparent
        animationType="fade"
        onRequestClose={() => setMapExpanded(false)}
      >
        <View style={StyleSheet.absoluteFill}>
          <VerifiedPropertyMap
            properties={[
              {
                id: p._id,
                type: p.type,
                status: p.status,
                price: p.price,
                location: p.location,
                parcelPoints: p.parcelPoints,
                title: p.title,
              },
            ]}
            onSelect={() => {}}
          />
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Close fullscreen map"
            onPress={() => setMapExpanded(false)}
            style={[styles.closeModalBtn, { top: Math.max(insets.top, 20) }]}
          >
            <MaterialIcons name="close" size={24} color="#0F172A" />
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Fullscreen Photo Gallery Modal */}
      <Modal
        visible={galleryExpanded}
        transparent
        animationType="fade"
        onRequestClose={() => setGalleryExpanded(false)}
      >
        <View style={styles.galleryModal}>
          <TouchableOpacity
            style={[styles.closeModalBtn, { top: Math.max(insets.top, 20) }]}
            onPress={() => setGalleryExpanded(false)}
            accessibilityLabel="Close gallery"
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.galleryMainImageContainer}>
            {photos[activePhoto] && (
              <Image
                source={photos[activePhoto]}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            )}
          </View>

          {photos.length > 1 && (
            <View style={styles.galleryControls}>
              <TouchableOpacity
                style={styles.galleryNavBtn}
                onPress={() =>
                  setActivePhoto((activePhoto + photos.length - 1) % photos.length)
                }
              >
                <MaterialIcons name="chevron-left" size={32} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.galleryCounterText}>
                {activePhoto + 1} / {photos.length}
              </Text>
              <TouchableOpacity
                style={styles.galleryNavBtn}
                onPress={() => setActivePhoto((activePhoto + 1) % photos.length)}
              >
                <MaterialIcons name="chevron-right" size={32} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    flexGrow: 1,
  },
  mainContainer: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },

  /* Breadcrumb & Quick Action Bar */
  breadcrumbBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 10,
    flexWrap: "wrap",
    gap: 8,
  },
  breadcrumbLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  breadcrumbLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  breadcrumbLinkText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284C7",
  },
  breadcrumbItem: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  breadcrumbActive: {
    color: "#0F172A",
    fontWeight: "700",
  },
  breadcrumbRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIconButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
        boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
      },
    }),
  },
  actionIconButtonSaved: {
    borderColor: "#FECDD3",
    backgroundColor: "#FFF1F2",
  },
  actionIconText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#03456C",
  },

  /* Hero Media Gallery Section */
  heroSection: {
    width: "100%",
    marginBottom: 24,
  },
  heroMainPhoto: {
    width: "100%",
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#0A2540",
    position: "relative",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    ...Platform.select({
      web: {
        boxShadow: "0 12px 36px rgba(3, 69, 108, 0.12)",
      },
    }),
  },
  placeholderContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    padding: 24,
    gap: 8,
  },
  placeholderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#334155",
  },
  placeholderSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
  },
  heroVerifiedBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    ...Platform.select({
      web: {
        backdropFilter: "blur(8px)",
        boxShadow: "0 4px 12px rgba(5, 150, 105, 0.15)",
      },
    }),
  },
  heroVerifiedText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
    letterSpacing: 0.2,
  },
  heroTypeBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(10, 37, 64, 0.88)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    ...Platform.select({
      web: {
        backdropFilter: "blur(8px)",
      },
    }),
  },
  heroTypeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.6,
  },
  carouselArrow: {
    position: "absolute",
    top: "50%",
    transform: [{ translateY: -22 }],
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    ...Platform.select({
      web: {
        cursor: "pointer",
        backdropFilter: "blur(6px)",
        boxShadow: "0 4px 14px rgba(15, 23, 42, 0.15)",
      },
    }),
  },
  carouselArrowLeft: {
    left: 16,
  },
  carouselArrowRight: {
    right: 16,
  },
  photoCountBadge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(15, 23, 42, 0.78)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    ...Platform.select({
      web: {
        backdropFilter: "blur(6px)",
      },
    }),
  },
  photoCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  fullscreenBtn: {
    position: "absolute",
    bottom: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        cursor: "pointer",
        backdropFilter: "blur(6px)",
      },
    }),
  },
  thumbnailStrip: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingVertical: 2,
  },
  thumbnailItem: {
    width: 80,
    height: 56,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    position: "relative",
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "transform 0.15s ease, border-color 0.15s ease",
      },
    }),
  },
  thumbnailActive: {
    borderColor: "#0284C7",
    transform: [{ scale: 1.04 }],
  },

  /* Responsive Layout Grid */
  layoutRow: {
    width: "100%",
  },
  layoutDesktop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 28,
  },
  layoutMobile: {
    flexDirection: "column",
    gap: 18,
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
    gap: 20,
  },
  sidebarColumn: {
    width: 380,
  },

  /* Card Container */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 22,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 18px rgba(15, 23, 42, 0.04)",
      },
    }),
  },

  /* Section Header */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2,
  },

  /* Title Card */
  titleTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    flexWrap: "wrap",
    gap: 8,
  },
  statusPills: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  legalCheckPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F9FF",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  legalCheckText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#03456C",
  },
  directPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  directText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#059669",
  },
  priceHighlight: {
    fontSize: 24,
    fontWeight: "800",
    color: "#03456C",
    letterSpacing: -0.6,
  },
  propertyTitle: {
    fontSize: 23,
    fontWeight: "800",
    color: "#0F172A",
    lineHeight: 31,
    marginBottom: 8,
    letterSpacing: -0.4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  locationText: {
    fontSize: 13.5,
    color: "#64748B",
    fontWeight: "500",
    flexShrink: 1,
  },

  /* Key Stats Grid (6 Items) */
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  statTile: {
    flex: 1,
    minWidth: 140,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "flex-start",
  },
  statIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statValue: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
    textTransform: "capitalize",
    marginBottom: 2,
  },
  statSub: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },

  /* Description */
  descriptionText: {
    fontSize: 14.5,
    lineHeight: 25,
    color: "#334155",
    fontWeight: "400",
  },

  /* Land & Access Specs Table */
  specsTable: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  specRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexWrap: "wrap",
    gap: 8,
  },
  specLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  specValue: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },

  /* Disclosures List */
  disclosuresList: {
    gap: 12,
    marginBottom: 16,
  },
  disclosureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  disclosureIconCircle: {
    marginTop: 2,
  },
  disclosureContent: {
    flex: 1,
  },
  disclosureTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 2,
  },
  disclosureDesc: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#64748B",
  },
  trustShieldBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F0F9FF",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  trustShieldTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#03456C",
    marginBottom: 2,
  },
  trustShieldDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: "#475569",
  },

  /* Embedded Map Container */
  embeddedMapBox: {
    width: "100%",
    height: 270,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    position: "relative",
    marginBottom: 14,
  },
  expandMapFloatingBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    zIndex: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        backdropFilter: "blur(6px)",
        boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
      },
    }),
  },
  expandMapFloatingText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#03456C",
  },
  googleMapsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "all 0.15s ease",
      },
    }),
  },
  googleMapsBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#03456C",
  },

  /* Video Tour */
  videoCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
    ...Platform.select({
      web: { cursor: "pointer" },
    }),
  },
  videoTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
  },
  videoSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },

  /* Right Sticky Sidebar (Desktop) */
  stickyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 24,
    ...Platform.select({
      web: {
        position: "sticky",
        top: 24,
        boxShadow: "0 12px 36px rgba(3, 69, 108, 0.12)",
      },
    }),
  },
  sidebarPriceSection: {
    marginBottom: 12,
  },
  sidebarPriceLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sidebarPriceValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#03456C",
    letterSpacing: -0.8,
  },
  sidebarPriceMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  sidebarRateBadge: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  sidebarRateText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#059669",
  },
  sidebarPriceTerms: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  emiBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 18,
  },
  emiText: {
    fontSize: 12.5,
    color: "#03456C",
  },
  emiBold: {
    fontWeight: "800",
    color: "#03456C",
  },
  sidebarDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginBottom: 18,
  },
  primaryCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#03456C",
    paddingVertical: 15,
    borderRadius: 14,
    marginBottom: 10,
    ...Platform.select({
      web: {
        cursor: "pointer",
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0A2540 100%)",
        boxShadow: "0 6px 20px rgba(3, 69, 108, 0.3)",
      },
    }),
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  secondaryCtaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    paddingVertical: 13,
    borderRadius: 14,
    marginBottom: 18,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  secondaryCtaText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#03456C",
  },
  advisorCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 16,
  },
  advisorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  advisorTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 2,
  },
  advisorDesc: {
    fontSize: 11,
    lineHeight: 16,
    color: "#64748B",
  },
  sidebarTrustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  sidebarTrustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sidebarTrustText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },

  /* Mobile Sticky Bottom Bar */
  mobileBottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1.5,
    borderTopColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    ...Platform.select({
      web: {
        boxShadow: "0 -8px 24px rgba(15, 23, 42, 0.08)",
      },
    }),
  },
  mobileBottomBarLeft: {
    flex: 1,
  },
  mobilePriceText: {
    fontSize: 20,
    fontWeight: "900",
    color: "#03456C",
    letterSpacing: -0.4,
  },
  mobileRateText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#059669",
  },
  mobileBottomBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mobileDirectionsBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1.5,
    borderColor: "#BAE6FD",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileOfferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#03456C",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      web: {
        backgroundImage: "linear-gradient(135deg, #03456C 0%, #0A2540 100%)",
      },
    }),
  },
  mobileOfferText: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#FFFFFF",
  },

  /* Modals */
  closeModalBtn: {
    position: "absolute",
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        cursor: "pointer",
      },
    }),
  },
  galleryModal: {
    flex: 1,
    backgroundColor: "rgba(10, 25, 47, 0.96)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryMainImageContainer: {
    width: "90%",
    height: "75%",
    position: "relative",
  },
  galleryControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginTop: 20,
  },
  galleryNavBtn: {
    padding: 8,
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  galleryCounterText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  errorNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECDD3",
    padding: 12,
    borderRadius: 12,
  },
  errorNoticeText: {
    fontSize: 13,
    color: "#DC2626",
    fontWeight: "600",
  },
});
