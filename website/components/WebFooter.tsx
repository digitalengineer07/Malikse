import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions, Platform, Linking, Image } from "react-native";
import { useRouter } from "@/web/navigation";
import { MaterialIcons } from "@/web/icons";
import { useAuthStore } from "../src/store/authStore";
import { FONT_BODY, FONT_DISPLAY, FONT_MONO } from "../constants/typography";
import malikseLogo from "../assets/images/malikse-logo.png";

const font = FONT_BODY;
const fontDisplay = FONT_DISPLAY;
const fontMono = FONT_MONO;

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
    <View style={styles.footerOuter}>
      {/* Signature Bottom-Right Sun Orb Decoration */}
      <View style={styles.sunOrb} pointerEvents="none" />

      <View style={styles.footerInner}>
        {/* Main 4-Column Footer Grid */}
        <View style={[styles.columnsGrid, { flexDirection: isDesktop ? "row" : "column" }]}>
          {/* Col 1: Brand Info */}
          <View style={[styles.brandCol, { width: isDesktop ? "32%" : "100%" }]}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/home")}
              style={styles.brandLockup}
            >
              <View style={styles.logoIcon}>
                <Image
                  source={{ uri: malikseLogo }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                  accessibilityLabel="MalikSe logo"
                />
              </View>
              <Text style={styles.brandName}>
                Malik<Text style={{ color: "#FCC61C" }}>Se</Text>
              </Text>
            </TouchableOpacity>

            <Text style={styles.brandDesc}>
              India's verified owner-to-buyer property marketplace. Zero brokerage, legally checked listings, and an advisor on every deal across all 38 districts of Bihar.
            </Text>

            <View style={styles.badgesRow}>
              <View style={styles.trustBadge}>
                <MaterialIcons name="verified" size={13} color="#FCC61C" />
                <Text style={styles.trustBadgeText}>100% Verified</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="gavel" size={13} color="#FCC61C" />
                <Text style={styles.trustBadgeText}>Title Checked</Text>
              </View>
              <View style={styles.trustBadge}>
                <MaterialIcons name="place" size={13} color="#FCC61C" />
                <Text style={styles.trustBadgeText}>GPS Boundary</Text>
              </View>
            </View>
          </View>

          {/* Col 2: Explore */}
          <View style={[styles.linkCol, { width: isDesktop ? "18%" : isTablet ? "48%" : "100%" }]}>
            <Text style={styles.colHeader}>EXPLORE</Text>
            <TouchableOpacity onPress={() => router.push({ pathname: "/search", params: { type: "flat" } } as any)}>
              <Text style={styles.linkText}>Flats & Apartments</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: "/search", params: { type: "house" } } as any)}>
              <Text style={styles.linkText}>Houses & Villas</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: "/search", params: { type: "land" } } as any)}>
              <Text style={styles.linkText}>Plots & Land</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push({ pathname: "/search", params: { type: "shop" } } as any)}>
              <Text style={styles.linkText}>Commercial & Offices</Text>
            </TouchableOpacity>
          </View>

          {/* Col 3: Owners */}
          <View style={[styles.linkCol, { width: isDesktop ? "18%" : isTablet ? "48%" : "100%" }]}>
            <Text style={styles.colHeader}>OWNERS</Text>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  authState === "AUTHENTICATED"
                    ? "/post"
                    : ({ pathname: "/login", params: { returnTo: "/post" } } as any)
                )
              }
            >
              <Text style={styles.linkText}>Post a property</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/kyc")}>
              <Text style={styles.linkText}>Verify with KYC</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/saved")}>
              <Text style={styles.linkText}>Saved properties</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/messages")}>
              <Text style={styles.linkText}>Property inquiries</Text>
            </TouchableOpacity>
          </View>

          {/* Col 4: Corporate Office & Legal */}
          <View style={[styles.linkCol, { width: isDesktop ? "24%" : "100%" }]}>
            <Text style={styles.colHeader}>COMPANY</Text>
            <Text style={styles.addressBold}>4th Floor, Om Ganga Complex</Text>
            <Text style={styles.linkTextMuted}>Saguna Danapur Station Road, Patna 801503</Text>

            <TouchableOpacity activeOpacity={0.75} style={styles.contactItem} onPress={openEmailSupport}>
              <MaterialIcons name="email" size={14} color="#FCC61C" style={{ marginTop: 2 }} />
              <Text style={styles.linkText}>support@malikse.in</Text>
            </TouchableOpacity>

            <View style={styles.contactItem}>
              <MaterialIcons name="schedule" size={14} color="rgba(255,255,255,0.55)" style={{ marginTop: 2 }} />
              <Text style={styles.linkTextMuted}>Mon – Sat, 9:00 AM – 7:00 PM IST</Text>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Open Help and Support page"
              activeOpacity={0.85}
              style={styles.supportButton}
              onPress={() => router.push("/support")}
            >
              <MaterialIcons name="support-agent" size={16} color="#14263E" />
              <Text style={styles.supportButtonText}>Help &amp; Support Center</Text>
              <MaterialIcons name="arrow-forward" size={14} color="#14263E" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Bottom Legal & Legal Assurance Ribbon */}
      <View style={styles.bottomBorder}>
        <View style={styles.bottomInner}>
          <View style={styles.legalRow}>
            <Text style={styles.copyrightText}>
              © {new Date().getFullYear()} MalikSe powered by AgHomesIndia. All rights reserved.
            </Text>
            <View style={styles.legalLinks}>
              <TouchableOpacity accessibilityRole="link" onPress={() => router.push("/support")}>
                <Text style={styles.legalLink}>Support</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>•</Text>
              <TouchableOpacity accessibilityRole="link" onPress={() => router.push("/privacy-policy")}>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}>•</Text>
              <TouchableOpacity accessibilityRole="link" onPress={() => router.push("/delete-account")}>
                <Text style={styles.legalLink}>Delete account</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.legalAssurance}>
            <MaterialIcons name="verified-user" size={16} color="#FCC61C" />
            <Text style={styles.legalAssuranceText}>Every listing checked by the MalikSe legal team</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footerOuter: {
    width: "100%",
    backgroundColor: "#14263E",
    marginTop: 48,
    position: "relative",
    overflow: "hidden",
  },
  sunOrb: {
    position: "absolute",
    right: -110,
    bottom: -150,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(252, 198, 28, 0.92)",
  },
  footerInner: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 34,
    position: "relative",
    zIndex: 2,
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
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#FCC61C",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontFamily: fontDisplay,
    fontSize: 24,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.25,
  },
  brandDesc: {
    fontFamily: font,
    fontSize: 13.5,
    lineHeight: 21,
    color: "rgba(255, 255, 255, 0.72)",
    maxWidth: 320,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  trustBadgeText: {
    fontFamily: fontMono,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.2,
    color: "#FFFFFF",
  },
  linkCol: {
    gap: 9,
  },
  colHeader: {
    fontFamily: fontMono,
    fontSize: 11.5,
    fontWeight: "800",
    color: "#FCC61C",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  linkText: {
    fontFamily: font,
    fontSize: 13.5,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.78)",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  linkTextMuted: {
    fontFamily: font,
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.62)",
    lineHeight: 19,
  },
  addressBold: {
    fontFamily: font,
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 2,
  },
  supportButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#FCC61C",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    ...Platform.select({
      web: {
        cursor: "pointer",
        boxShadow: "0 10px 20px -10px rgba(252, 198, 28, 0.75)",
      },
    }),
  },
  supportButtonText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "800",
    color: "#14263E",
  },
  bottomBorder: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(12, 26, 44, 0.45)",
    position: "relative",
    zIndex: 2,
  },
  bottomInner: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  legalRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 14,
  },
  copyrightText: {
    fontFamily: font,
    fontSize: 12.5,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.6)",
  },
  legalLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  legalLink: {
    fontFamily: font,
    fontSize: 12.5,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
    ...Platform.select({ web: { cursor: "pointer" } }),
  },
  legalDot: {
    color: "rgba(255, 255, 255, 0.35)",
  },
  legalAssurance: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legalAssuranceText: {
    fontFamily: font,
    fontSize: 12.5,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.78)",
  },
});
