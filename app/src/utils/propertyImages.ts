import type { ImageSourcePropType } from "react-native";

export const PROPERTY_IMAGES = {
  commercialShop: require("../../assets/properties/commercial_shop.jpg") as ImageSourcePropType,
  commercialOffice: require("../../assets/properties/commercial_office.jpg") as ImageSourcePropType,
  duplexHouse: require("../../assets/properties/duplex_house.jpg") as ImageSourcePropType,
  plotPatnaAerial: require("../../assets/plot_patna_aerial.jpg") as ImageSourcePropType,
  plotDanapurField: require("../../assets/plot_danapur_field.jpg") as ImageSourcePropType,
  savedPlotLand: require("../../assets/saved_plot_land.jpg") as ImageSourcePropType,
  savedVillaHouse: require("../../assets/saved_villa_house.jpg") as ImageSourcePropType,
  villaEstate: require("../../assets/auth_hero_land.jpg") as ImageSourcePropType,
};

const LAND_VARIANTS = [
  PROPERTY_IMAGES.plotPatnaAerial,
  PROPERTY_IMAGES.plotDanapurField,
  PROPERTY_IMAGES.savedPlotLand,
];
const HOUSE_VARIANTS = [
  PROPERTY_IMAGES.duplexHouse,
  PROPERTY_IMAGES.savedVillaHouse,
  PROPERTY_IMAGES.villaEstate,
];
const SHOP_VARIANTS = [
  PROPERTY_IMAGES.commercialShop,
  PROPERTY_IMAGES.commercialOffice,
];

function stableIndex(seed: string | number | undefined, length: number): number {
  if (!length) return 0;
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return Math.abs(Math.floor(seed)) % length;
  }
  const str = String(seed || "");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
}

/**
 * Selects a bundled property photograph matching the listing's type so app
 * cards always display a proper photo even when remote media is missing or fails.
 */
export function getFallbackPropertyPhotoSource(
  property: any,
  fallbackIndex?: number,
): ImageSourcePropType {
  const rawType = String(property?.type || "").toLowerCase();
  const titleLower = String(property?.title || "").toLowerCase();
  const seed = fallbackIndex !== undefined ? fallbackIndex : property?._id || property?.id || property?.title;

  if (rawType === "office") return PROPERTY_IMAGES.commercialOffice;
  if (rawType === "shop" || rawType === "commercial") {
    return SHOP_VARIANTS[stableIndex(seed, SHOP_VARIANTS.length)];
  }
  if (
    rawType === "house" ||
    rawType === "villa" ||
    titleLower.includes("villa") ||
    titleLower.includes("duplex")
  ) {
    return HOUSE_VARIANTS[stableIndex(seed, HOUSE_VARIANTS.length)];
  }
  if (rawType === "flat" || rawType === "apartment" || rawType === "pg" || rawType === "room") {
    return PROPERTY_IMAGES.savedVillaHouse;
  }
  if (rawType === "land" || rawType === "plot") {
    return LAND_VARIANTS[stableIndex(seed, LAND_VARIANTS.length)];
  }
  return PROPERTY_IMAGES.duplexHouse;
}

/**
 * Returns the uploaded primary photo source when present, or falls back to a
 * bundled property photograph matching the listing type.
 */
export function resolvePropertyPhotoSource(
  property: any,
  fallbackIndex?: number,
): ImageSourcePropType {
  const uploaded = Array.isArray(property?.media?.photos)
    ? property.media.photos.find((u: unknown) => typeof u === "string" && u.trim().length > 0)
    : undefined;
  if (uploaded) return { uri: uploaded };

  return getFallbackPropertyPhotoSource(property, fallbackIndex);
}
