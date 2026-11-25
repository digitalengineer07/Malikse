import commercialShopImg from "../../assets/properties/commercial_shop.jpg";
import commercialOfficeImg from "../../assets/properties/commercial_office.jpg";
import duplexHouseImg from "../../assets/properties/duplex_house.jpg";
import plotPatnaAerialImg from "../../assets/plot_patna_aerial.jpg";
import plotDanapurFieldImg from "../../assets/plot_danapur_field.jpg";
import savedPlotLandImg from "../../assets/saved_plot_land.jpg";
import savedVillaHouseImg from "../../assets/saved_villa_house.jpg";
import villaEstateImg from "../../assets/auth_hero_land.jpg";

export const PROPERTY_IMAGES = {
  commercialShop: commercialShopImg,
  commercialOffice: commercialOfficeImg,
  duplexHouse: duplexHouseImg,
  plotPatnaAerial: plotPatnaAerialImg,
  plotDanapurField: plotDanapurFieldImg,
  savedPlotLand: savedPlotLandImg,
  savedVillaHouse: savedVillaHouseImg,
  villaEstate: villaEstateImg,
};

const LAND_VARIANTS = [plotPatnaAerialImg, plotDanapurFieldImg, savedPlotLandImg];
const HOUSE_VARIANTS = [duplexHouseImg, savedVillaHouseImg, villaEstateImg];
const SHOP_VARIANTS = [commercialShopImg, commercialOfficeImg];

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
 * Selects a high-resolution local property photograph matching the listing's
 * property type so cards can always display or fall back to a proper photo.
 */
export function getFallbackPropertyPhotoUrl(property: any, fallbackIndex?: number): string {
  const rawType = String(property?.type || "").toLowerCase();
  const titleLower = String(property?.title || "").toLowerCase();
  const seed = fallbackIndex !== undefined ? fallbackIndex : property?._id || property?.id || property?.title;

  if (rawType === "office") return commercialOfficeImg;
  if (rawType === "shop" || rawType === "commercial") {
    return SHOP_VARIANTS[stableIndex(seed, SHOP_VARIANTS.length)];
  }
  if (rawType === "house" || rawType === "villa" || titleLower.includes("villa") || titleLower.includes("duplex")) {
    return HOUSE_VARIANTS[stableIndex(seed, HOUSE_VARIANTS.length)];
  }
  if (rawType === "flat" || rawType === "apartment" || rawType === "pg" || rawType === "room") {
    return savedVillaHouseImg;
  }
  if (rawType === "land" || rawType === "plot") {
    return LAND_VARIANTS[stableIndex(seed, LAND_VARIANTS.length)];
  }
  return duplexHouseImg;
}

/**
 * Returns the uploaded primary photo URL when present, or selects a high-resolution
 * local property photograph matching the listing's property type so cards never render empty.
 */
export function resolvePropertyPhotoUrl(property: any, fallbackIndex?: number): string {
  const uploaded = Array.isArray(property?.media?.photos)
    ? property.media.photos.find((u: unknown) => typeof u === "string" && u.trim().length > 0)
    : undefined;
  if (uploaded) return uploaded;

  return getFallbackPropertyPhotoUrl(property, fallbackIndex);
}
