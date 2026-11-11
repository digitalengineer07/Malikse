import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform, Linking } from "react-native";
import { useRouter } from "@/web/navigation";
import { MaterialIcons } from "@/web/icons";
import { useAuthStore } from "../src/store/authStore";

const font = Platform.OS === "web" ? "'Plus Jakarta Sans', Manrope, -apple-system, BlinkMacSystemFont, sans-serif" : "PoppinsRegular";
const fontDisplay = Platform.OS === "web" ? "'Plus Jakarta Sans', PoppinsBold, Manrope, sans-serif" : "PoppinsBold";

export default function WebFooter() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  const isTablet = width >= 600 && width < 900;
  const authState = useAuthStore((s) => s.authState);

  const openEmailSupport = () => {
    Linking.openURL("mailto:support@malikse.in");
  };

  return (
    <View style={styles.footerWrapper}>
      <View style={styles.footerCard}>
        {/* Top Institutional Trust Ribbon */}
        <View style={[styles.trustRibbon, { flexDirection: isDesktop ? "row" : "column" }]}>
          <View style={styles.trustRibbonLeft}>
            <View style={styles.trustIconPill}>
              <MaterialIcons name="verified-user" size={20} color="#0A45B5" />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={styles.trustEyebrow}>BIHAR REVENUE & PROPERTY INTEGRITY ASSURANCE</Text>
              <Text style={styles.trustTitle}>Building Trust in Every Square Foot</Text>
            </View>
          </View>

          <View style={styles.trustBadgesRow}>
            <View style={styles.ribbonBadgeItem}>
              <MaterialIcons name="gavel" size={13} color="#059669" />
              <Text style={styles.ribbonBadgeText}>Title & Deed Reviewed</Text>
            </View>
            <View style={styles.ribbonBadgeItem}>
              <MaterialIcons name="gps-fixed" size={13} color="#0A45B5" />
              <Text style={styles.ribbonBadgeText}>Cadastral GPS Boundaries</Text>
            </View>
            <View style={styles.ribbonBadgeItem}>
              <MaterialIcons name="handshake" size={13} color="#D97706" />
              <Text style={styles.ribbonBadgeText}>Verified Listings · Assigned Support</Text>
            </View>
          </View>
        </View>

        {/* Main Footer Links Columns */}
        <View style={[styles.columnsGrid, { flexDirection: isDesktop ? "row" : "column" }]}>
          {/* Col 1: Brand Info */}
          <View style={[styles.brandCol, { width: isDesktop ? "31%" : "100%" }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/home")}
              style={styles.brandLockup}
            >
              <View style={styles.logoIcon}>
                <MaterialIcons name="roofing" size={19} color="white" />
              </View>
              <View style={styles.brandTextCol}>
                <Text style={styles.brandName}>
                  MalikSe<Text style={{ color: "#10B981" }}>.</Text>
                </Text>
                <Text style={styles.brandTagline}>
                  Verified spaces · Trusted connections
                </Text>
              </View>
            </TouchableOpacity>

            <Text style={styles.brandDesc}>
              Bihar's premier verified real estate network. Connecting buyers, sellers, and investors through cadastral accuracy, title verification, and dedicated local property advisors.
            </Text>

            <View style={styles.badgesRow}>
              <View style={styles.trustBadge}>
                <MaterialIcons name="verified" size={13} color="#0A45B5" />
                <Text style={styles.trustBadgeText}>100% Verified</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="gavel" size={13} color="#059669" />
                <Text style={[styles.trustBadgeText, { color: "#059669" }]}>Legal Checks</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="place" size={13} color="#D97706" />
                <Text style={[styles.trustBadgeText, { color: "#D97706" }]}>GPS Demarcated</Text>
              </View>
            </View>
          </View>

          {/* Col 2: Properties */}
          <View style={[styles.linkCol, { width: isDesktop ? "19%" : isTablet ? "48%" : "100%" }]}>
            <Text style={styles.colHeader}>Properties</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: "/home", params: { type: "land" } })}>
              <Text style={styles.linkText}>Residential Land & Plots</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: "/home", params: { type: "flat" } })}>
              <Text style={styles.linkText}>Flats & Apartments</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: "/home", params: { type: "house" } })}>
              <Text style={styles.linkText}>Villas & Detached Houses</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: "/home", params: { type: "shop" } })}>
              <Text style={styles.linkText}>Commercial Shops</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: "/home", params: { type: "office" } })}>
              <Text style={styles.linkText}>Executive Offices</Text>
            </TouchableOpacity>
          </View>

          {/* Col 3: Quick Navigation */}
          <View style={[styles.linkCol, { width: isDesktop ? "19%" : isTablet ? "48%" : "100%" }]}>
            <Text style={styles.colHeader}>Quick Links</Text>
            <TouchableOpacity onPress={() => router.push("/search")}>
              <Text style={styles.linkText}>Explore All Listings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  authState === "AUTHENTICATED"
                    ? "/post"
                    : ({ pathname: "/login", params: { returnTo: "/post" } } as any)
                )
              }
            >
              <Text style={styles.linkText}>Post Your Property</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/saved")}>
              <Text style={styles.linkText}>Saved Properties</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/messages")}>
              <Text style={styles.linkText}>Property Inquiries</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/kyc")}>
              <Text style={styles.linkText}>Identity Verification</Text>
            </TouchableOpacity>
          </View>

          {/* Col 4: Corporate Office */}
          <View style={[styles.linkCol, { width: isDesktop ? "25%" : "100%" }]}>
            <View style={styles.officeHeaderRow}>
              <MaterialIcons name="place" size={17} color="#10B981" />
              <Text style={styles.colHeader}>Corporate Office</Text>
            </View>

            <View style={styles.addressBlock}>
              <Text style={styles.addressBold}>4th Floor, Om Ganga Complex</Text>
              <Text style={styles.contactText}>Saguna Danapur Station Road</Text>
              <Text style={styles.contactText}>Patna 801503</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.contactItem}
              onPress={openEmailSupport}
            >
              <MaterialIcons name="email" size={15} color="#64748B" style={{ marginTop: 2 }} />
              <Text style={styles.contactLinkText}>Direct Support: support@malikse.in</Text>
            </TouchableOpacity>

            <View style={styles.contactItem}>
              <MaterialIcons name="schedule" size={15} color="#64748B" style={{ marginTop: 2 }} />
              <Text style={styles.contactText}>Mon – Sat, 9:00 AM – 7:00 PM IST</Text>
            </View>

            <View style={styles.patnaPill}>
              <MaterialIcons name="location-city" size={13} color="#15803D" />
              <Text style={styles.patnaPillText}>Serving All 38 Districts of Bihar</Text>
            </View>
          </View>
        </View>

        {/* Bottom Copyright and Meta */}
        <View style={styles.bottomBar}>
          <Text style={styles.copyrightText}>
            © {new Date().getFullYear()} Malikse powered by AgHomesIndia. All rights reserved.
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity accessibilityRole="link" onPress={() => router.push("/privacy-policy")}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity accessibilityRole="link" onPress={() => router.push("/delete-account")}>
              <Text style={styles.legalLink}>Delete account</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <Text style={styles.legalLink}>Terms of Service</Text>
            <Text style={styles.legalDot}>•</Text>
            <Text style={styles.legalLink}>Land Law Advisory</Text>
            <Text style={styles.legalDot}>•</Text>
            <Text style={styles.legalLink}>Security</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerWrapper: {
    width: "100%",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    backgroundColor: "transparent",
  },
  footerCard: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 22,
    paddingHorizontal: 26,
    gap: 20,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 20px rgba(11, 27, 63, 0.04)",
      },
    }),
  },
  trustRibbon: {
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  trustRibbonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trustIconPill: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  trustEyebrow: {
    fontSize: 9,
    fontWeight: "800",
    color: "#0A45B5",
    letterSpacing: 0.8,
    fontFamily: font,
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B1B3F",
    fontFamily: fontDisplay,
    letterSpacing: -0.3,
  },
  trustBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  ribbonBadgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
  },
  ribbonBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    fontFamily: font,
  },
  columnsGrid: {
    justifyContent: "space-between",
    gap: 20,
  },
  brandCol: {
    gap: 10,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 2,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  logoIcon: {
    backgroundColor: "#0A45B5",
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 6px rgba(10, 69, 181, 0.2)",
      },
    }),
  },
  brandTextCol: {
    justifyContent: "center",
  },
  brandName: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0B1B3F",
    fontFamily: fontDisplay,
    letterSpacing: -0.6,
    lineHeight: 24,
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    fontFamily: font,
    letterSpacing: 0.1,
    lineHeight: 13,
  },
  brandDesc: {
    fontSize: 12.5,
    color: "#64748B",
    fontFamily: font,
    lineHeight: 18,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 2,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
  },
  trustBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#0A45B5",
    fontFamily: font,
  },
  linkCol: {
    gap: 8,
  },
  colHeader: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0B1B3F",
    fontFamily: fontDisplay,
    letterSpacing: 0.1,
  },
  linkText: {
    fontSize: 12.5,
    color: "#475569",
    fontWeight: "500",
    fontFamily: font,
    lineHeight: 17,
    ...Platform.select({
      web: {
        cursor: "pointer",
        transition: "color 0.15s ease",
      },
    }),
  },
  officeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 2,
  },
  addressBlock: {
    gap: 1,
    marginBottom: 2,
  },
  addressBold: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0F172A",
    fontFamily: font,
    lineHeight: 17,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
  },
  contactText: {
    fontSize: 12.5,
    color: "#64748B",
    fontFamily: font,
    lineHeight: 17,
    flex: 1,
  },
  contactLinkText: {
    fontSize: 12.5,
    color: "#64748B",
    fontFamily: font,
    lineHeight: 17,
    flex: 1,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  patnaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  patnaPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D",
    fontFamily: font,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  copyrightText: {
    fontSize: 11.5,
    color: "#94A3B8",
    fontFamily: font,
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontSize: 11.5,
    color: "#64748B",
    fontFamily: font,
    ...Platform.select({
      web: {
        cursor: "pointer",
      },
    }),
  },
  legalDot: {
    fontSize: 11,
    color: "#CBD5E1",
  },
});
