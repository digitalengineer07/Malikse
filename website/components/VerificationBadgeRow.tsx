import React from "react";
import { StyleSheet, ScrollView } from "react-native";
import BadgeChip from "./BadgeChip";
import type { PropertyBadges } from "../src/types/property.types";
import { t } from "../src/i18n/translations";
import { useLanguageStore } from "../src/store/languageStore";

interface VerificationBadgeRowProps {
  badges: PropertyBadges;
}

export default function VerificationBadgeRow({ badges }: VerificationBadgeRowProps) {
  const { language } = useLanguageStore();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      <BadgeChip label={t(language, "badge_identity")} active={badges.identityVerified} icon="id-card" />
      <BadgeChip label={t(language, "badge_documents")} active={badges.documentsChecked} icon="file-signature" />
      <BadgeChip label={t(language, "badge_site")} active={badges.siteVisited} icon="map-marked-alt" />
      <BadgeChip label={t(language, "badge_lawyer")} active={badges.lawyerReviewed} icon="balance-scale" />
      <BadgeChip label={t(language, "badge_fully")} active={badges.fullyVerified} icon="check-circle" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    flexDirection: "row",
  },
});
