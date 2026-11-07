import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from "react-native";
import { useRouter } from "@/web/navigation";
import { MaterialIcons } from "@/web/icons";

export default function WebFooter() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  return (
    <View style={styles.footerWrapper}>
      <View style={styles.footerCard}>
        {/* Top Institutional Trust Ribbon */}
        <View style={[styles.trustRibbon, { flexDirection: isDesktop ? "row" : "column" }]}>
          <View style={styles.trustRibbonLeft}>
            <View style={styles.trustIconPill}>
              <MaterialIcons name="verified-user" size={22} color="#0A45B5" />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={styles.trustEyebrow}>BIHAR REVENUE & PROPERTY INTEGRITY ASSURANCE</Text>
              <Text style={styles.trustTitle}>Building Trust in Every Square Foot</Text>
            </View>
          </View>

          <View style={styles.trustBadgesRow}>
            <View style={styles.ribbonBadgeItem}>
              <MaterialIcons name="gavel" size={14} color="#059669" />
              <Text style={styles.ribbonBadgeText}>Title & Deed Reviewed</Text>
            </View>
            <View style={styles.ribbonBadgeItem}>
              <MaterialIcons name="gps-fixed" size={14} color="#0A45B5" />
              <Text style={styles.ribbonBadgeText}>Cadastral GPS Boundaries</Text>
            </View>
            <View style={styles.ribbonBadgeItem}>
              <MaterialIcons name="handshake" size={14} color="#D97706" />
              <Text style={styles.ribbonBadgeText}>Verified Listings · Assigned Support</Text>
            </View>
          </View>
        </View>

        {/* Main Footer Links Columns */}
        <View style={[styles.columnsGrid, { flexDirection: isDesktop ? "row" : "column" }]}>
          {/* Col 1: Brand Info */}
          <View style={[styles.brandCol, { width: isDesktop ? "32%" : "100%" }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => router.push("/home")}
              style={styles.brandLockup}
            >
              <View style={styles.logoIcon}>
                <MaterialIcons name="roofing" size={20} color="white" />
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
                <MaterialIcons name="verified" size={14} color="#0A45B5" />
                <Text style={styles.trustBadgeText}>100% Verified</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="gavel" size={14} color="#059669" />
                <Text style={[styles.trustBadgeText, { color: "#059669" }]}>Legal Checks</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="place" size={14} color="#D97706" />
                <Text style={[styles.trustBadgeText, { color: "#D97706" }]}>GPS Demarcated</Text>
              </View>
            </View>
          </View>

          {/* Col 2: Properties */}
          <View style={[styles.linkCol, { width: isDesktop ? "21%" : "100%" }]}>
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
          <View style={[styles.linkCol, { width: isDesktop ? "21%" : "100%" }]}>
            <Text style={styles.colHeader}>Quick Links</Text>
            <TouchableOpacity onPress={() => router.push("/search")}>
              <Text style={styles.linkText}>Explore All Listings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/post")}>
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

          {/* Col 4: Regional & Help */}
          <View style={[styles.linkCol, { width: isDesktop ? "24%" : "100%" }]}>
            <Text style={styles.colHeader}>Headquarters</Text>
            <View style={styles.contactItem}>
              <MaterialIcons name="place" size={16} color="#64748B" style={{ marginTop: 2 }} />
              <Text style={styles.contactText}>Patna Sadar, Patna, Bihar — 800001</Text>
            </View>
            <View style={styles.contactItem}>
              <MaterialIcons name="email" size={16} color="#64748B" style={{ marginTop: 2 }} />
              <Text style={styles.contactText}>Direct Support: support@malikse.in</Text>
            </View>
            <View style={styles.contactItem}>
              <MaterialIcons name="schedule" size={16} color="#64748B" style={{ marginTop: 2 }} />
              <Text style={styles.contactText}>Mon – Sat, 9:00 AM – 7:00 PM IST</Text>
            </View>

            <View style={styles.patnaPill}>
              <MaterialIcons name="location-city" size={14} color="#15803D" />
              <Text style={styles.patnaPillText}>Serving All 38 Districts of Bihar</Text>
            </View>
          </View>
        </View>

        {/* Bottom Copyright and Meta */}
        <View style={styles.bottomBar}>
          <Text style={styles.copyrightText}>
            © {new Date().getFullYear()} MalikSe Technologies Pvt. Ltd. All rights reserved.
          </Text>
          <View style={styles.legalLinks}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
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
    paddingTop: 8,
    paddingBottom: 36,
    backgroundColor: "transparent",
  },
  footerCard: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 32,
    gap: 26,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 24px rgba(11, 27, 63, 0.04)",
      },
    }),
  },
  trustRibbon: {
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 18,
    gap: 16,
  },
  trustRibbonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  trustIconPill: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  trustEyebrow: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#0A45B5",
    letterSpacing: 0.8,
  },
  trustTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0B1B3F",
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
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ribbonBadgeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#334155",
  },
  columnsGrid: {
    justifyContent: "space-between",
    gap: 28,
  },
  brandCol: {
    gap: 12,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  logoIcon: {
    backgroundColor: "#0A45B5",
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      web: {
        boxShadow: "0 2px 8px rgba(10, 69, 181, 0.22)",
      },
    }),
  },
  brandTextCol: {
    justifyContent: "center",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  brandTagline: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 0.1,
    lineHeight: 14,
  },
  brandDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0A45B5",
  },
  linkCol: {
    gap: 10,
  },
  colHeader: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  linkText: {
    fontSize: 13.5,
    color: "#475569",
    fontWeight: "500",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  contactText: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
    flex: 1,
  },
  patnaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  patnaPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#15803D",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  copyrightText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontSize: 12,
    color: "#64748B",
  },
  legalDot: {
    fontSize: 12,
    color: "#CBD5E1",
  },
});
