import React, { useEffect, useState } from "react";
import { Image, Keyboard, Linking, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguageStore } from "../src/store/languageStore";

export default function AccountArtworkFooter({
  bottomExtension = 0,
  wavesOnly = false,
  illustration,
  hideWhileTyping = true,
}: { bottomExtension?: number; wavesOnly?: boolean; illustration?: React.ReactElement | null; hideWhileTyping?: boolean }) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom + bottomExtension;
  const compact = height - insets.top - insets.bottom < 850;
  const waveHeight = compact ? 38 : 54;
  const language = useLanguageStore(state => state.language);
  const label = (english: string, hindi: string) => language === "hi" ? hindi : english;
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());
  const [supportError, setSupportError] = useState("");
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (hideWhileTyping && keyboardVisible) return <View style={{ height: 18 }} />;

  return (
    <>
      {wavesOnly ? <View style={[styles.waveSpacing, illustration && styles.illustrationSpacing]}>{illustration}</View> : (
        <View style={[styles.signInFooter, compact && styles.compactFooter]}>
          <View pointerEvents="none" style={[styles.artCrop, styles.houseArt, compact && styles.compactHouse]}>
            <Image source={require("../assets/images/modern_house_with_location_pin.png")} style={styles.houseAsset} resizeMode="stretch" accessible={false} />
          </View>
          <Text accessibilityRole="header" style={styles.footerHeading}>{label("Buy & Sell Property", "प्रॉपर्टी खरीदें और बेचें")}</Text>
          <View pointerEvents="none" style={[styles.artCrop, styles.ownerBadge]}>
            <Image source={require("../assets/images/directly_from_the_owner_badge.png")} style={styles.ownerAsset}
              resizeMode="stretch" accessible accessibilityLabel="Directly from the Owner" />
          </View>
          <View style={styles.footerActions}>
            <TouchableOpacity accessibilityRole="link" style={styles.support}
              onPress={() => void Linking.openURL(`${(process.env.EXPO_PUBLIC_WEBSITE_URL || "https://malikse.com").replace(/\/+$/, "")}/support`).catch(() => {
                setSupportError(label("Visit https://malikse.com/support or email support@malikse.in for help.", "सहायता के लिए https://malikse.com/support पर जाएं या support@malikse.in पर ईमेल करें।"));
              })}>
              <View style={[styles.artCrop, styles.supportIcon]}>
                <Image source={require("../assets/images/sign_in_contact_support_icon.png")} style={styles.supportAsset} resizeMode="stretch" accessible={false} />
              </View>
              <Text style={styles.link}>{label("Contact support", "सहायता से संपर्क करें")}</Text>
            </TouchableOpacity>
          </View>
          {!!supportError && <Text accessibilityRole="alert" style={styles.supportError}>{supportError}</Text>}
        </View>
      )}
      <View pointerEvents="none" style={[styles.artCrop, styles.footerWaves, !wavesOnly && styles.waveOverlap, { height: waveHeight + bottomInset }]}>
        <View style={[styles.waveBase, { height: bottomInset + 2 }]} />
        <Image source={require("../assets/images/navy_waves_with_rising_sun.png")}
          style={[styles.wavesAsset, { height: waveHeight * 2.07, bottom: bottomInset }]} resizeMode="stretch" accessible={false} />
      </View>
    </>
  );
}

const navy = "#14263E";
const styles = StyleSheet.create({
  signInFooter: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingTop: 12 },
  artCrop: { overflow: "hidden" },
  houseArt: { width: "90%", maxWidth: 420, aspectRatio: 1448 / 540 },
  houseAsset: { position: "absolute", width: "100%", height: "201.11%", top: "-61.11%" },
  footerHeading: { color: navy, fontFamily: "ManropeExtraBold", fontSize: 17, lineHeight: 22, textAlign: "center" },
  ownerBadge: { width: "52%", maxWidth: 224, aspectRatio: 1900 / 258 },
  ownerAsset: { position: "absolute", width: "114.32%", height: "280.62%", left: "-7.16%", top: "-91.09%" },
  footerActions: { flexDirection: "row", justifyContent: "center", alignItems: "center", width: "100%", maxWidth: 460, paddingHorizontal: 14, marginTop: 2, zIndex: 1 },
  supportIcon: { width: 17, height: 17 },
  supportAsset: { position: "absolute", width: "190%", height: "190%", left: "-44.7%", top: "-47.7%" },
  support: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12 },
  footerWaves: { width: "100%" },
  waveOverlap: { marginTop: -15 },
  waveSpacing: { flexGrow: 1, minHeight: 16 },
  illustrationSpacing: { alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  compactFooter: { paddingTop: 8 },
  compactHouse: { width: "78%", maxWidth: 330 },
  waveBase: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "#142D4B" },
  wavesAsset: { position: "absolute", width: "100%" },
  link: { color: navy, fontFamily: "ManropeBold", lineHeight: 22, textAlign: "center" },
  supportError: { color: "#A52D3B", fontFamily: "Manrope", textAlign: "center", paddingHorizontal: 16, paddingBottom: 10 },
});
