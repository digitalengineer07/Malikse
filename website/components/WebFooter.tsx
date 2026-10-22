import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import BiharHeritageWatermark from "./BiharHeritageWatermark";

export default function WebFooter() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 800;

  return (
    <View style={styles.footerContainer}>
      <View style={styles.footerInner}>
        {/* Top Decorative Trust Strip */}
        <View style={styles.trustStrip}>
          <View style={styles.trustLeft}>
            <BiharHeritageWatermark width={140} height={38} opacity={0.8} />
            <View style={styles.trustDivider} />
            <View>
              <Text style={styles.trustTitle}>Building Trust in</Text>
              <Text style={styles.trustTitle}>Every Square Foot</Text>
            </View>
          </View>

          <View style={styles.trustRight}>
            <Text style={styles.calligraphyTagline}>Verified Land, Brighter Tomorrows</Text>
          </View>
        </View>

        <View style={styles.dividerLine} />

        {/* Main Footer Links Columns */}
        <View style={[styles.columnsGrid, { flexDirection: isDesktop ? "row" : "column" }]}>
          {/* Col 1: Brand Info */}
          <View style={[styles.brandCol, { width: isDesktop ? "32%" : "100%" }]}>
            <View style={styles.logoRow}>
              {Platform.OS === "web" ? (
                <svg width="28" height="28" viewBox="0 0 32 32" style={{ display: "block" }}>
                  <path d="M3,16 L16,5 L29,16 L25.5,16 L16,8.2 L6.5,16 Z" fill="#03456C" />
                  <rect x="22" y="7" width="3" height="6" fill="#03456C" rx="0.5" />
                  <rect x="8" y="18" width="6.5" height="5.5" fill="#0284C7" rx="0.8" />
                  <rect x="16.5" y="18" width="6.5" height="5.5" fill="#0284C7" rx="0.8" />
                  <rect x="8" y="24.8" width="6.5" height="5" fill="#38BDF8" rx="0.8" />
                  <rect x="16.5" y="24.8" width="6.5" height="5" fill="#38BDF8" rx="0.8" />
                </svg>
              ) : (
                <MaterialIcons name="home" size={26} color="#03456C" />
              )}
              <Text style={styles.brandName}>MalikSe</Text>
            </View>

            <Text style={styles.brandDesc}>
              Bihar’s premier verified property ecosystem. Every property undergoes rigorous revenue record verification, physical boundary inspection, and lawyer approval.
            </Text>

            <View style={styles.badgesRow}>
              <View style={styles.trustBadge}>
                <MaterialIcons name="verified-user" size={14} color="#03456C" />
                <Text style={styles.trustBadgeText}>100% Verified</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="gavel" size={14} color="#03456C" />
                <Text style={styles.trustBadgeText}>Legal Checks</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="place" size={14} color="#03456C" />
                <Text style={styles.trustBadgeText}>GPS Demarcated</Text>
              </View>
            </View>
          </View>

          {/* Col 2: Properties */}
          <View style={[styles.linkCol, { width: isDesktop ? "22%" : "100%" }]}>
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
          <View style={[styles.linkCol, { width: isDesktop ? "22%" : "100%" }]}>
            <Text style={styles.colHeader}>Quick Links</Text>
            <TouchableOpacity onPress={() => router.push("/search")}>
              <Text style={styles.linkText}>Explore All Listings</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/listing/create")}>
              <Text style={styles.linkText}>Post Your Property</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/saved")}>
              <Text style={styles.linkText}>Saved Properties</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/messages")}>
              <Text style={styles.linkText}>Direct Inquiries</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/kyc")}>
              <Text style={styles.linkText}>Demo KYC Verification</Text>
            </TouchableOpacity>
          </View>

          {/* Col 4: Regional & Help */}
          <View style={[styles.linkCol, { width: isDesktop ? "24%" : "100%" }]}>
            <Text style={styles.colHeader}>Headquarters</Text>
            <Text style={styles.contactText}>Patna Sadar, Patna, Bihar — 800001</Text>
            <Text style={styles.contactText}>Direct Support: support@malikse.in</Text>
            <Text style={styles.contactText}>Mon – Sat, 9:00 AM – 7:00 PM IST</Text>

            <View style={styles.patnaPill}>
              <MaterialIcons name="location-on" size={14} color="#0284C7" />
              <Text style={styles.patnaPillText}>Serving All 38 Districts of Bihar</Text>
            </View>
          </View>
        </View>

        <View style={styles.bottomDivider} />

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
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerContainer: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.75)",
    borderTopWidth: 1,
    borderTopColor: "rgba(3, 69, 108, 0.12)",
    paddingTop: 36,
    paddingBottom: 32,
    marginTop: 40,
  },
  footerInner: {
    maxWidth: 1340,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 28,
  },
  trustStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    paddingBottom: 22,
  },
  trustLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  trustDivider: {
    width: 1.5,
    height: 32,
    backgroundColor: "#94A3B8",
  },
  trustTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A192F",
    lineHeight: 18,
  },
  trustRight: {
    justifyContent: "center",
  },
  calligraphyTagline: {
    fontSize: 22,
    fontWeight: "700",
    color: "#03456C",
    fontFamily: Platform.OS === "web" ? "Caveat, cursive" : undefined,
    letterSpacing: 0.5,
  },
  dividerLine: {
    height: 1,
    backgroundColor: "rgba(3, 69, 108, 0.08)",
    marginBottom: 30,
  },
  columnsGrid: {
    justifyContent: "space-between",
    gap: 28,
  },
  brandCol: {
    marginBottom: 10,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0A192F",
    letterSpacing: -0.5,
  },
  brandDesc: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 20,
    marginBottom: 16,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EBF3F8",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#03456C",
  },
  linkCol: {
    marginBottom: 12,
  },
  colHeader: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0A192F",
    marginBottom: 14,
    letterSpacing: -0.2,
  },
  linkText: {
    fontSize: 13,
    color: "#475569",
    marginBottom: 10,
    fontWeight: "500",
  },
  contactText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 8,
    lineHeight: 18,
  },
  patnaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  patnaPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284C7",
  },
  bottomDivider: {
    height: 1,
    backgroundColor: "rgba(3, 69, 108, 0.08)",
    marginTop: 26,
    marginBottom: 20,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  copyrightText: {
    fontSize: 12,
    color: "#64748B",
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
    color: "#94A3B8",
  },
});
