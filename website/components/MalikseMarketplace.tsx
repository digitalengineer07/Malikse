import { randomUUID } from "@/web/crypto";
import { useSafeAreaInsets } from "@/web/safeArea";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from "@/web/navigation";
import { MaterialIcons } from "@/web/icons";
import * as DocumentPicker from "@/web/files";
import * as Location from "@/web/location";
import AsyncStorage from "@/web/storage";
import api, { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { userService } from "../src/services/userService";
import { prepareUpload } from "../src/services/prepareUpload";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import MapParcelPicker, { LatLngPoint } from "./MapParcelPicker";
import { dashboardRoutes } from "../src/utils/accountRoutes";
import WebFooter from "./WebFooter";
import AppHeader from "./AppHeader";
const C = {
  bg: "#f3f7ff",
  ink: "#0b1b3f",
  muted: "#475a82",
  blue: "#0a45b5",
  line: "#dce5f5",
  green: "#0b5a3a",
};
const money = (n: number) =>
  `₹${n >= 10000000 ? (n / 10000000).toFixed(2) + " Cr" : n >= 100000 ? (n / 100000).toFixed(1) + " Lakh" : Number(n || 0).toLocaleString("en-IN")}`;
const label = (p: any) =>
  p.title || `${p.type} in ${p.location?.district || ""}`;
const errorText = (e: any) =>
  e?.response?.data?.message ||
  e?.response?.data?.error ||
  e?.message ||
  "Please retry.";
const identity = (v: any) => (typeof v === "string" ? v : v?._id);
const approved = (u: any) => u?.isVerifiedIdentity || u?.demoKycComplete;
const types = [
  ["", "All", "domain"],
  ["flat", "Apartment", "apartment"],
  ["house", "House", "home"],
  ["land", "Plot", "landscape"],
  ["shop", "Commercial", "storefront"],
  ["office", "Office", "business"],
];
const popularDistricts = [
  "All Bihar",
  "Patna",
  "Gaya",
  "Begusarai",
  "Muzaffarpur",
  "Bhagalpur",
  "Darbhanga",
  "Vaishali",
  "Purnia",
];
function Icon({ name, color = C.blue, size = 22 }: any) {
  return <MaterialIcons name={name} size={size} color={color} />;
}
function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, disabled && { opacity: 0.5 }]}
    >
      {!!icon && <Icon name={icon} color={secondary ? C.blue : "white"} />}
      <Text style={[s.buttonText, secondary && { color: C.blue }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Tag({ children, green = false }: any) {
  return (
    <View style={[s.tag, green && { backgroundColor: "#e0f5e9" }]}>
      <Text style={[s.tagText, green && { color: C.green }]}>{children}</Text>
    </View>
  );
}
function Empty({
  title = "Nothing here yet",
  text = "New activity will appear here.",
  action,
}: any) {
  return (
    <View style={[s.panel, { alignItems: "center", padding: 32 }]}>
      <Icon name="real-estate-agent" size={40} />
      <Text style={s.h2}>{title}</Text>
      <Text style={s.muted}>{text}</Text>
      {action}
    </View>
  );
}
function Field({
  title,
  value,
  onChangeText,
  numeric = false,
  multiline = false,
  placeholder,
}: any) {
  return (
    <View style={{ flex: 1, minWidth: 140, gap: 7 }}>
      <Text style={s.fieldLabel}>{title}</Text>
      <TextInput
        accessibilityLabel={title}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        placeholder={placeholder || title}
        placeholderTextColor="#8291ac"
      />
    </View>
  );
}
function useData(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [nextCursor, setNextCursor] = useState("");
  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(path);
      setData(response.data);
      setNextCursor(response.headers["x-next-cursor"] || "");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [path, ...deps]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    setData(null);
  }, [path, ...deps]);
  const loadMore = async () => {
    if (!path || !nextCursor || loading) return;
    setLoading(true);
    try {
      const response = await api.get(
        path +
          (path.includes("?") ? "&" : "?") +
          "cursor=" +
          encodeURIComponent(nextCursor),
      );
      setData((old: any[]) => [
        ...old,
        ...response.data.filter(
          (p: any) => !old.some((item) => item._id === p._id),
        ),
      ]);
      setNextCursor(response.headers["x-next-cursor"] || "");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  return { data, error, loading, refresh, setData, nextCursor, loadMore };
}
function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return {
    busy,
    error,
    run: async (fn: () => Promise<any>) => {
      setBusy(true);
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(errorText(e));
      } finally {
        setBusy(false);
      }
    },
  };
}
function ErrorBox({ text }: any) {
  return text ? (
    <Text accessibilityRole="alert" style={s.error}>
      {text}
    </Text>
  ) : null;
}
function useGate() {
  const user = useAuthStore((x) => x.user),
    router = useRouter(),
    path = usePathname();
  return (kyc = false) => {
    if (!user) {
      router.push({
        pathname: "/(auth)/login",
        params: { returnTo: path },
      } as any);
      return false;
    }
    if (kyc && !approved(user)) {
      router.push({ pathname: "/kyc", params: { returnTo: path } } as any);
      return false;
    }
    return true;
  };
}
export function MarketplaceShell({
  title,
  subtitle,
  children,
  back = false,
}: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter(),
    path = usePathname(),
    { width } = useWindowDimensions(),
    user = useAuthStore((x) => x.user);
  const isDesktop = width >= 768;

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <AppHeader showBack={back} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.scroll}>
          <View style={s.content}>
            {!!title && (
              <View style={{ gap: 6 }}>
                <Text style={s.h1}>{title}</Text>
                {!!subtitle && <Text style={s.muted}>{subtitle}</Text>}
              </View>
            )}
            {children}
          </View>
        </View>
        {isDesktop && <WebFooter />}
      </ScrollView>

      {!isDesktop && (
        <View style={[s.nav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          {[
            ["/home", "home", "Home"],
            ["/search", "search", "Search"],
            ["/post", "add", "Post"],
            ["/messages", "chat-bubble-outline", "Chats"],
            ["/profile", "person-outline", "Profile"],
          ].map(([url, icon, text]) => (
            <Pressable
              key={url}
              accessibilityRole="button"
              onPress={() => router.push(url as any)}
              style={[s.navItem, url === "/post" && { marginTop: -18 }]}
            >
              <View style={url === "/post" ? s.postCircle : undefined}>
                <Icon
                  name={icon}
                  color={
                    url === "/post" ? "white" : path === url ? C.blue : C.muted
                  }
                />
              </View>
              <Text
                style={[
                  s.navText,
                  path === url && { color: C.blue, fontWeight: "800" },
                ]}
              >
                {text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
function Protected({ children, kyc = false }: any) {
  const user = useAuthStore((x) => x.user),
    gate = useGate();
  if (!user || (kyc && !approved(user)))
    return (
      <Empty
        title={
          !user
            ? "Your next step starts here"
            : "Complete identity verification"
        }
        text={
          !user
            ? "Browse freely. Sign in to save properties and manage your account."
            : "Approved KYC is required to sell, make an offer or contact assigned staff."
        }
        action={
          <Button
            title={!user ? "Sign in / Register" : "Continue to KYC"}
            onPress={() => gate(kyc)}
          />
        }
      />
    );
  return children;
}
function PropertyCard({
  property: p,
  compact = false,
  onSaved,
  initiallySaved = false,
}: any) {
  const router = useRouter(),
    gate = useGate(),
    action = useAction(),
    [saved, setSaved] = useState(initiallySaved);
  return (
    <View style={[s.card, compact && { flexDirection: "row" }]}>
      <Pressable
        style={compact ? { width: 112, minHeight: 130 } : s.photo}
        onPress={() => router.push(`/property/${p._id}` as any)}
      >
        {p.media?.photos?.[0] ? (
          <Image
            source={{ uri: p.media.photos[0] }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, s.placeholder]}>
            <Icon name="home-work" size={48} color="#91a9d4" />
          </View>
        )}
        <View style={s.imageTags}>
          <Tag green>✓ Verified</Tag>
        </View>
      </Pressable>
      <View style={[s.cardBody, compact && { flex: 1 }]}>
        <View style={s.between}>
          <Text style={s.price}>{money(p.price)}</Text>
          <Pressable
            accessibilityLabel={
              saved ? "Remove from wishlist" : "Save property"
            }
            disabled={action.busy}
            onPress={() => {
              if (gate())
                void action.run(async () => {
                  const result = await userService.toggleWishlist(p._id);
                  setSaved(result.isWishlisted);
                  if (result.isWishlisted)
                    void api
                      .post(`/recommendations/${p._id}/activity`, {
                        kind: "save",
                      })
                      .catch(() => {});
                  onSaved?.();
                });
            }}
          >
            <Icon name={saved ? "favorite" : "favorite-border"} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.push(`/property/${p._id}` as any)}>
          <Text style={s.cardTitle}>{label(p)}</Text>
        </Pressable>
        <Text style={s.muted}>
          {p.location?.district}, {p.location?.state}
        </Text>
        <View style={s.row}>
          <Tag>{p.type}</Tag>
          <Text style={s.small}>{p.sellableArea || p.totalArea} sq ft</Text>
        </View>
        <ErrorBox text={action.error} />
      </View>
    </View>
  );
}
export function HomeScreen() {
  const user = useAuthStore((x) => x.user),
    router = useRouter(),
    [query, setQuery] = useState(""),
    [locationInput, setLocationInput] = useState(""),
    [type, setType] = useState(""),
    [focusedField, setFocusedField] = useState<"location" | "query" | null>(null),
    [prefs, setPrefs] = useState<any>({});

  useEffect(() => {
    AsyncStorage.getItem(`marketplace_preferences_${user?.id || "guest"}`)
      .then((v) => {
        if (v) {
          const parsed = JSON.parse(v);
          setPrefs(parsed);
          if (parsed.district && parsed.district.toLowerCase() !== "rps") {
            setLocationInput(parsed.district);
          }
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const handleSearch = () => {
    const params: Record<string, string> = {};
    if (query.trim()) params.q = query.trim();
    if (
      locationInput.trim() &&
      locationInput.trim().toLowerCase() !== "all bihar" &&
      locationInput.trim().toLowerCase() !== "explore all bihar"
    ) {
      params.district = locationInput.trim();
    }
    if (type) params.type = type;
    router.push({
      pathname: "/search",
      params,
    } as any);
  };

  const hasActiveSearch = Boolean(
    query.trim() ||
      (locationInput.trim() && locationInput.trim().toLowerCase() !== "all bihar") ||
      type
  );

  const activeDistrictParam =
    locationInput.trim() && locationInput.trim().toLowerCase() !== "all bihar"
      ? locationInput.trim()
      : "";

  const liveSearchResults = useData(
    hasActiveSearch
      ? `/properties/search?limit=12&q=${encodeURIComponent(query.trim())}${
          activeDistrictParam ? "&district=" + encodeURIComponent(activeDistrictParam) : ""
        }${type ? "&type=" + type : ""}`
      : null,
    [query, activeDistrictParam, type]
  );

  const personal = useData(
      `/recommendations?mode=personalized&district=${encodeURIComponent(
        activeDistrictParam || prefs.district || ""
      )}&type=${type || prefs.type || ""}&maxPrice=${prefs.maxPrice || ""}`,
      [user?.id, activeDistrictParam, type],
    ),
    recent = useData("/recommendations?mode=new"),
    trending = useData("/recommendations?mode=trending"),
    { width } = useWindowDimensions();

  return (
    <MarketplaceShell>
      <View style={s.heroContainer}>
        {/* Top Trust Eyebrow */}
        <View style={s.heroBadgeRow}>
          <View style={s.heroBadge}>
            <Icon name="verified" size={14} color={C.blue} />
            <Text style={s.heroBadgeText}>
              100% ON-GROUND & DOCUMENT-VERIFIED SPACES
            </Text>
          </View>
        </View>

        {/* Heading & Subtitle */}
        <View style={{ gap: 6 }}>
          <Text style={s.heroHeading}>
            {`Hello, ${user ? user.name.split(" ")[0] : "welcome"} 👋`}
          </Text>
          <Text style={s.heroSubheading}>
            Find verified plots, homes & commercial spaces in Bihar with transparent pricing and legal clarity.
          </Text>
        </View>

        {/* Segmented Luxury Search Console */}
        <View
          style={[
            s.searchConsole,
            width < 768 && { flexDirection: "column", alignItems: "stretch", padding: 10 },
          ]}
        >
          <View
            style={[
              s.searchSegmentLocation,
              { flex: 1 },
              focusedField === "location" && s.searchSegmentFocused,
            ]}
          >
            <View
              style={[
                s.searchSegmentIconWrap,
                focusedField === "location" && { backgroundColor: "#DBEAFE" },
              ]}
            >
              <Icon name="location-on" size={19} color={C.blue} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={[
                  s.searchSegmentLabel,
                  focusedField === "location" && { color: "#0A45B5" },
                ]}
              >
                LOCATION
              </Text>
              <TextInput
                accessibilityLabel="Location or District"
                placeholder="District (e.g. Patna, Gaya...)"
                placeholderTextColor="#94a3b8"
                value={locationInput}
                onChangeText={setLocationInput}
                onFocus={() => setFocusedField("location")}
                onBlur={() => setFocusedField(null)}
                style={s.searchTextInput}
                onSubmitEditing={handleSearch}
              />
            </View>
            {!!locationInput && (
              <TouchableOpacity
                onPress={() => setLocationInput("")}
                style={s.searchClearBtn}
                accessibilityLabel="Clear location"
              >
                <Icon name="close" size={14} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          {width >= 768 ? (
            <View style={s.searchDivider} />
          ) : (
            <View style={{ height: 1, backgroundColor: "#e2e8f0", marginVertical: 6 }} />
          )}

          <View
            style={[
              s.searchSegmentInput,
              { flex: 1.4 },
              focusedField === "query" && s.searchSegmentFocused,
              width < 768 && { paddingHorizontal: 4 },
            ]}
          >
            <View
              style={[
                s.searchSegmentIconWrap,
                focusedField === "query" && { backgroundColor: "#DBEAFE" },
              ]}
            >
              <Icon
                name="search"
                size={19}
                color={focusedField === "query" ? C.blue : "#64748B"}
              />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text
                style={[
                  s.searchSegmentLabel,
                  focusedField === "query" && { color: "#0A45B5" },
                ]}
              >
                SEARCH PROPERTY
              </Text>
              <TextInput
                accessibilityLabel="Search property"
                placeholder="City, locality, road corridor or ID..."
                placeholderTextColor="#94a3b8"
                value={query}
                onChangeText={setQuery}
                onFocus={() => setFocusedField("query")}
                onBlur={() => setFocusedField(null)}
                style={s.searchTextInput}
                onSubmitEditing={handleSearch}
              />
            </View>
            {!!query && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                style={s.searchClearBtn}
                accessibilityLabel="Clear query"
              >
                <Icon name="close" size={14} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={handleSearch}
            style={[s.searchSubmitBtn, width < 768 && { marginTop: 8, justifyContent: "center" }]}
            activeOpacity={0.85}
          >
            <Icon name="search" size={18} color="white" />
            <Text style={s.searchSubmitBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Popular Districts Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2, alignItems: "center" }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "#64748B",
              marginRight: 4,
              fontFamily: font,
            }}
          >
            Popular:
          </Text>
          {popularDistricts.map((d) => {
            const isSelected =
              (d === "All Bihar" && (!locationInput || locationInput.toLowerCase() === "all bihar")) ||
              locationInput.toLowerCase() === d.toLowerCase();
            return (
              <TouchableOpacity
                key={d}
                onPress={() => setLocationInput(d === "All Bihar" ? "" : d)}
                style={{
                  paddingVertical: 5,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  backgroundColor: isSelected ? "#0A45B5" : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isSelected ? "#0A45B5" : "#E2E8F0",
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? "700" : "600",
                    color: isSelected ? "#FFFFFF" : "#475569",
                    fontFamily: font,
                  }}
                >
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Category Filter Pills */}
        <View style={s.categoryPillsRow}>
          {types.map(([id, text, icon]) => {
            const isSelected = type === id;
            return (
              <Pressable
                key={id}
                onPress={() => setType(isSelected ? "" : id)}
                style={[
                  s.categoryPill,
                  isSelected && s.categoryPillActive,
                ]}
              >
                <Icon
                  name={icon}
                  color={isSelected ? "white" : "#475569"}
                  size={15}
                />
                <Text
                  style={[
                    s.categoryPillText,
                    isSelected && s.categoryPillTextActive,
                  ]}
                >
                  {text}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Trust Points Strip */}
        <View style={s.heroTrustStrip}>
          <View style={s.trustItem}>
            <Icon name="check-circle" size={15} color="#10b981" />
            <Text style={s.trustItemText}>Title & Deed Verified</Text>
          </View>
          <View style={s.trustDot} />
          <View style={s.trustItem}>
            <Icon name="my-location" size={15} color={C.blue} />
            <Text style={s.trustItemText}>Cadastral Map Boundary</Text>
          </View>
          <View style={s.trustDot} />
          <View style={s.trustItem}>
            <Icon name="support-agent" size={15} color="#f59e0b" />
            <Text style={s.trustItemText}>Dedicated Property Verifier</Text>
          </View>
        </View>
      </View>

      {/* Live Search Results Section (Renders immediately when searching/filtering on Home) */}
      {hasActiveSearch && (
        <View style={{ gap: 14, marginVertical: 6 }}>
          <View style={s.between}>
            <View style={{ gap: 3, flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Text style={s.h2}>Search Results</Text>
                <View
                  style={{
                    backgroundColor: "#EFF6FF",
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#DBEAFE",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#0A45B5", fontFamily: font }}>
                    {liveSearchResults.data?.length ?? 0} Found
                  </Text>
                </View>
              </View>
              <Text style={s.small}>
                {query.trim() ? `Matching "${query.trim()}"` : "All listings"}
                {activeDistrictParam ? ` in ${activeDistrictParam}` : ""}
                {type ? ` · ${types.find((t) => t[0] === type)?.[1] || type}` : ""}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setQuery("");
                  setLocationInput("");
                  setType("");
                }}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: 10,
                  backgroundColor: "#F1F5F9",
                  borderRadius: 10,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#475569", fontFamily: font }}>
                  Reset Filters
                </Text>
              </TouchableOpacity>
              <Pressable onPress={handleSearch}>
                <Text style={s.link}>Open in Map / Explore →</Text>
              </Pressable>
            </View>
          </View>
          {liveSearchResults.loading ? (
            <ActivityIndicator color={C.blue} style={{ padding: 24 }} />
          ) : liveSearchResults.error ? (
            <ErrorBox text={liveSearchResults.error} />
          ) : !liveSearchResults.data?.length ? (
            <Empty
              title="No properties found"
              text={`No matching verified spaces for "${query || activeDistrictParam}". Try searching by another district or keyword.`}
            />
          ) : (
            <View style={s.grid}>
              {liveSearchResults.data.map((p: any) => (
                <View
                  key={p._id}
                  style={{
                    width: width > 1000 ? "31.8%" : width > 650 ? "48.5%" : "100%",
                  }}
                >
                  <PropertyCard property={p} />
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {[
        [
          "Recommended for You",
          "Inspired by your searches and wishlist",
          personal,
        ],
        ["New Properties", "Recently verified and published", recent],
        [
          "Trending Properties",
          "Popular with property seekers this week",
          trending,
        ],
      ].map(([title, sub, feed]: any) => (
        <View key={title} style={{ gap: 14 }}>
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{title}</Text>
              <Text style={s.small}>{sub}</Text>
            </View>
            <Pressable onPress={() => router.push("/search")}>
              <Text style={s.link}>View all →</Text>
            </Pressable>
          </View>
          {feed.loading ? (
            <ActivityIndicator color={C.blue} />
          ) : feed.error ? (
            <ErrorBox text={feed.error} />
          ) : !feed.data?.length ? (
            <Empty
              title="Properties are on their way"
              text="Verified listings will appear here as they become available."
            />
          ) : (
            <View style={s.grid}>
              {feed.data
                .filter((p: any) => !type || p.type === type)
                .slice(0, 6)
                .map((p: any) => (
                  <View
                    key={p._id}
                    style={{
                      width:
                        width > 1000 ? "31.8%" : width > 650 ? "48.5%" : "100%",
                    }}
                  >
                    <PropertyCard
                      property={p}
                      compact={title === "New Properties" && width < 650}
                    />
                  </View>
                ))}
            </View>
          )}
        </View>
      ))}
      <View style={[s.panel, s.row]}>
        <Icon name="handshake" size={34} />
        <View style={{ flex: 1 }}>
          <Text style={s.cardTitle}>Real people, every step of the way</Text>
          <Text style={s.muted}>
            Your assigned team helps with questions, offers and deal closure.
          </Text>
        </View>
      </View>
    </MarketplaceShell>
  );
}

export function SearchScreen() {
  const params = useLocalSearchParams(),
    router = useRouter(),
    user = useAuthStore((x) => x.user),
    [query, setQuery] = useState(String(params.q || params.location || "")),
    [district, setDistrict] = useState(String(params.district || "")),
    [type, setType] = useState(String(params.type || "")),
    [max, setMax] = useState(""),
    [filter, setFilter] = useState(false),
    [map, setMap] = useState(true),
    [selected, setSelected] = useState<any>(null),
    [submitted, setSubmitted] = useState(String(params.q || params.location || ""));

  useEffect(() => {
    const qVal = String(params.q || params.location || "");
    setQuery(qVal);
    setSubmitted(qVal);
    if (params.district !== undefined) setDistrict(String(params.district || ""));
    if (params.type !== undefined) setType(String(params.type || ""));
  }, [params.q, params.location, params.district, params.type]);

  const feed = useData(
    `/properties/search?limit=50&q=${encodeURIComponent(submitted)}${
      district ? "&district=" + encodeURIComponent(district) : ""
    }${type ? "&type=" + type : ""}${max ? "&maxPrice=" + max : ""}`,
    [submitted, district, type, max]
  );
  const select = useCallback((p: any) => setSelected(p), []);
  useEffect(() => {
    if (submitted && feed.data)
      for (const property of feed.data.slice(0, 5))
        void api
          .post(`/recommendations/${property._id}/activity`, { kind: "search" })
          .catch(() => {});
  }, [feed.data, submitted]);
  const search = () => {
    setSubmitted(query);
    if (user)
      void api
        .post("/recommendations/preferences", {
          district: district || query,
          type,
          ...(max ? { maxPrice: Number(max) } : {}),
        })
        .catch(() => {});
    void AsyncStorage.setItem(
      `marketplace_preferences_${user?.id || "guest"}`,
      JSON.stringify({ district: district || query, type, maxPrice: max }),
    );
  };
  return (
    <MarketplaceShell
      title="Explore properties"
      subtitle="Find your place on the map. Every listing is verified."
    >
      <View style={s.wrap}>
        <View style={[s.input, s.row, { flex: 1.5, minWidth: 200 }]}>
          <Icon name="search" />
          <TextInput
            accessibilityLabel="Search properties"
            value={query}
            onChangeText={setQuery}
            placeholder="Property name, locality, road or ID..."
            onSubmitEditing={search}
            style={{ flex: 1 }}
          />
          {!!query && (
            <TouchableOpacity onPress={() => { setQuery(""); setSubmitted(""); }}>
              <Icon name="close" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <View style={[s.input, s.row, { flex: 1, minWidth: 150 }]}>
          <Icon name="location-on" color="#94a3b8" />
          <TextInput
            accessibilityLabel="Filter by district"
            value={district}
            onChangeText={setDistrict}
            placeholder="District (e.g. Patna, Gaya)"
            onSubmitEditing={search}
            style={{ flex: 1 }}
          />
          {!!district && (
            <TouchableOpacity onPress={() => setDistrict("")}>
              <Icon name="close" size={16} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        <Button title="Search" onPress={search} />
        <Button
          title="Filters"
          secondary
          icon="tune"
          onPress={() => setFilter(!filter)}
        />
      </View>

      {(!!submitted || !!district || !!type) && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingVertical: 2 }}>
          <Text style={{ fontSize: 13, color: "#64748B", fontWeight: "600", fontFamily: font }}>Filters:</Text>
          {!!submitted && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#EFF6FF", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, borderWidth: 1, borderColor: "#DBEAFE" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#0A45B5", fontFamily: font }}>Query: "{submitted}"</Text>
              <TouchableOpacity onPress={() => { setQuery(""); setSubmitted(""); }}>
                <Icon name="close" size={14} color="#0A45B5" />
              </TouchableOpacity>
            </View>
          )}
          {!!district && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, borderWidth: 1, borderColor: "#A7F3D0" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#059669", fontFamily: font }}>District: {district}</Text>
              <TouchableOpacity onPress={() => setDistrict("")}>
                <Icon name="close" size={14} color="#059669" />
              </TouchableOpacity>
            </View>
          )}
          {!!type && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF7ED", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, borderWidth: 1, borderColor: "#FFEDD5" }}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#EA580C", fontFamily: font }}>Type: {type.toUpperCase()}</Text>
              <TouchableOpacity onPress={() => setType("")}>
                <Icon name="close" size={14} color="#EA580C" />
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity onPress={() => { setQuery(""); setSubmitted(""); setDistrict(""); setType(""); setMax(""); }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#DC2626", marginLeft: 4, fontFamily: font }}>Clear All</Text>
          </TouchableOpacity>
        </View>
      )}

      {filter && (
        <View style={s.panel}>
          <Field
            title="Maximum price (₹)"
            value={max}
            onChangeText={setMax}
            numeric
          />
          <View style={s.wrap}>
            {types.map(([id, text]) => (
              <Button
                key={id}
                secondary={type !== id}
                title={text}
                onPress={() => setType(type === id ? "" : id)}
              />
            ))}
          </View>
          <Button
            secondary
            title="Reset filters"
            onPress={() => {
              setType("");
              setMax("");
            }}
          />
        </View>
      )}
      <View style={s.between}>
        <Tag green>✓ Verified properties only</Tag>
        <Button
          secondary
          title={map ? "List view" : "Map view"}
          icon={map ? "view-list" : "map"}
          onPress={() => setMap(!map)}
        />
      </View>
      <ErrorBox text={feed.error} />
      {feed.loading && <ActivityIndicator color={C.blue} />}
      {map && (
        <View style={s.map}>
          <VerifiedPropertyMap properties={feed.data || []} onSelect={select} />
        </View>
      )}
      {selected && map && (
        <View style={s.panel}>
          <PropertyCard property={selected} compact />
          <Button
            title="View full property details"
            onPress={() => router.push(`/property/${selected._id}` as any)}
          />
        </View>
      )}
      {(!map || !selected) && (
        <View style={s.grid}>
          {(feed.data || []).map((p: any) => (
            <View style={{ minWidth: 270, flex: 1, maxWidth: 520 }} key={p._id}>
              <PropertyCard property={p} />
            </View>
          ))}
        </View>
      )}
      {!!feed.nextCursor && (
        <Button
          title="Load more properties"
          secondary
          disabled={feed.loading}
          onPress={feed.loadMore}
        />
      )}
      {feed.data?.length === 0 && (
        <Empty
          title="No matches yet"
          text="Try a different location or budget."
        />
      )}
    </MarketplaceShell>
  );
}
export function WishlistScreen() {
  const user = useAuthStore((x) => x.user),
    feed = useData(user ? "/users/wishlist" : null, [user?.id]),
    [sort, setSort] = useState(false);
  const rows = [...(feed.data || [])];
  if (sort) rows.sort((a, b) => a.price - b.price);
  return (
    <MarketplaceShell
      title="Saved Properties"
      subtitle={`${rows.length} available properties bookmarked`}
      back
    >
      <Protected>
        <View style={s.between}>
          <Tag>Your wishlist</Tag>
          <Button
            secondary
            title={sort ? "Newest saved" : "Sort by price"}
            icon="sort"
            onPress={() => setSort(!sort)}
          />
        </View>
        <ErrorBox text={feed.error} />
        {feed.loading && <ActivityIndicator />}
        {rows.map((p) => (
          <PropertyCard
            key={p._id}
            property={p}
            initiallySaved
            onSaved={feed.refresh}
          />
        ))}
        {!!feed.nextCursor && (
          <Button
            title="Load more properties"
            secondary
            disabled={feed.loading}
            onPress={feed.loadMore}
          />
        )}
        {feed.data?.length === 0 && (
          <Empty
            title="Keep your favourites close"
            text="Tap the heart on a property to save it here. Sold listings are no longer shown."
          />
        )}
      </Protected>
    </MarketplaceShell>
  );
}
export function ProfileScreen() {
  const user = useAuthStore((x) => x.user),
    router = useRouter(),
    action = useAction(),
    [expandedSection, setExpandedSection] = useState<string | null>(null),
    [name, setName] = useState(user?.name || ""),
    [email, setEmail] = useState(user?.email || ""),
    [saveSuccess, setSaveSuccess] = useState(false),
    myListings = useData(user ? "/properties/mine" : null, [user?.id]),
    mySaved = useData(user ? "/users/wishlist" : null, [user?.id]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user?.name, user?.email]);

  const toggleSection = (section: string) => {
    setSaveSuccess(false);
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  const handleSaveProfile = () => {
    action.run(async () => {
      await userService.updateProfile({ name, email });
      await authService.getMe();
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setExpandedSection(null);
      }, 1800);
    });
  };

  const isApproved = approved(user);

  return (
    <MarketplaceShell title="Your account">
      <Protected>
        {user && (
          <View style={{ gap: 20 }}>
            {/* Top Profile Header Card */}
            <View style={profileStyles.profileHeaderCard}>
              <View style={profileStyles.profileHeaderRow}>
                <View style={profileStyles.profileUserGroup}>
                  <View style={profileStyles.avatarCircle}>
                    <Text style={profileStyles.avatarInitial}>
                      {(user.name?.[0] || "M").toUpperCase()}
                    </Text>
                  </View>
                  <View style={profileStyles.profileInfo}>
                    <Text style={profileStyles.userName}>{user.name}</Text>
                    <View style={profileStyles.contactRow}>
                      <View style={profileStyles.contactItem}>
                        <MaterialIcons name="phone" size={15} color="#64748B" />
                        <Text style={profileStyles.contactText}>
                          {user.mobile ? `+91 ${user.mobile}` : "No mobile"}
                        </Text>
                      </View>
                      {!!user.email && (
                        <View style={profileStyles.contactItem}>
                          <MaterialIcons name="email" size={15} color="#64748B" />
                          <Text style={profileStyles.contactText}>{user.email}</Text>
                        </View>
                      )}
                    </View>
                    <View style={profileStyles.badgeRow}>
                      <View style={isApproved ? profileStyles.approvedBadge : profileStyles.pendingBadge}>
                        <MaterialIcons
                          name={isApproved ? "verified" : "schedule"}
                          size={14}
                          color={isApproved ? "#059669" : "#D97706"}
                        />
                        <Text style={isApproved ? profileStyles.approvedBadgeText : profileStyles.pendingBadgeText}>
                          {isApproved ? "✓ Identity Approved" : "Identity Verification Pending"}
                        </Text>
                      </View>
                      <View style={profileStyles.roleBadge}>
                        <Text style={profileStyles.roleBadgeText}>
                          {user.role === "user" ? "Property Owner / Buyer" : String(user.role).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Right side stats & action */}
                <View style={profileStyles.statsRow}>
                  <TouchableOpacity
                    style={profileStyles.statTile}
                    onPress={() => toggleSection("my_properties")}
                    activeOpacity={0.8}
                  >
                    <View style={[profileStyles.statTileIconWrap, { backgroundColor: "#EFF6FF" }]}>
                      <MaterialIcons name="apartment" size={20} color="#0A45B5" />
                    </View>
                    <View>
                      <Text style={profileStyles.statTileVal}>{myListings.data?.length ?? 0}</Text>
                      <Text style={profileStyles.statTileLabel}>Properties</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={profileStyles.statTile}
                    onPress={() => router.push("/saved")}
                    activeOpacity={0.8}
                  >
                    <View style={[profileStyles.statTileIconWrap, { backgroundColor: "#FDF2F8" }]}>
                      <MaterialIcons name="favorite" size={20} color="#DB2777" />
                    </View>
                    <View>
                      <Text style={profileStyles.statTileVal}>{mySaved.data?.length ?? 0}</Text>
                      <Text style={profileStyles.statTileLabel}>Wishlist</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={profileStyles.editProfileBtn}
                    onPress={() => toggleSection("personal_info")}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="edit" size={16} color="#0A45B5" />
                    <Text style={profileStyles.editProfileBtnText}>Edit Profile</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={profileStyles.sectionTitle}>Account & preferences</Text>

            {/* 1. Personal Information Option */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[
                  profileStyles.optionCard,
                  expandedSection === "personal_info" && profileStyles.optionCardActive,
                ]}
                onPress={() => toggleSection("personal_info")}
                activeOpacity={0.8}
              >
                <View style={[profileStyles.optionIconBox, { backgroundColor: "#EFF6FF" }]}>
                  <MaterialIcons name="manage-accounts" size={22} color="#0A45B5" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={profileStyles.optionTitle}>Personal information</Text>
                  <Text style={profileStyles.optionSubtitle}>Update your name, email, and contact details</Text>
                </View>
                <MaterialIcons
                  name={expandedSection === "personal_info" ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={24}
                  color={expandedSection === "personal_info" ? "#0A45B5" : "#94A3B8"}
                />
              </TouchableOpacity>

              {expandedSection === "personal_info" && (
                <View style={profileStyles.expandableBox}>
                  <View style={profileStyles.expandableHeader}>
                    <Text style={profileStyles.expandableTitle}>Update Personal Information</Text>
                    <TouchableOpacity onPress={() => setExpandedSection(null)}>
                      <MaterialIcons name="close" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {saveSuccess && (
                    <View style={profileStyles.successBanner}>
                      <MaterialIcons name="check-circle" size={18} color="#059669" />
                      <Text style={profileStyles.successBannerText}>Profile updated successfully!</Text>
                    </View>
                  )}

                  {action.error ? <ErrorBox text={action.error} /> : null}

                  <View style={profileStyles.formInputWrap}>
                    <Text style={profileStyles.formInputLabel}>Full Name *</Text>
                    <TextInput
                      style={profileStyles.formTextInput}
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter your full name"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <View style={profileStyles.formInputWrap}>
                    <Text style={profileStyles.formInputLabel}>Email Address</Text>
                    <TextInput
                      style={profileStyles.formTextInput}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="e.g. name@example.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={profileStyles.formInputWrap}>
                    <Text style={profileStyles.formInputLabel}>Registered Mobile Number</Text>
                    <View style={{ position: "relative", justifyContent: "center" }}>
                      <TextInput
                        style={[profileStyles.formTextInput, { backgroundColor: "#F8FAFC", color: "#64748B", paddingRight: 110 }]}
                        value={user.mobile ? `+91 ${user.mobile}` : ""}
                        editable={false}
                      />
                      <View style={{ position: "absolute", right: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <MaterialIcons name="verified" size={14} color="#059669" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#059669" }}>OTP Verified</Text>
                      </View>
                    </View>
                  </View>

                  <View style={profileStyles.formActionsRow}>
                    <TouchableOpacity
                      style={profileStyles.saveBtn}
                      onPress={handleSaveProfile}
                      disabled={action.busy}
                      activeOpacity={0.8}
                    >
                      {action.busy ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <MaterialIcons name="check" size={18} color="#FFFFFF" />
                      )}
                      <Text style={profileStyles.saveBtnText}>
                        {action.busy ? "Saving Changes..." : "Save Changes"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={profileStyles.cancelBtn}
                      onPress={() => setExpandedSection(null)}
                      disabled={action.busy}
                      activeOpacity={0.8}
                    >
                      <Text style={profileStyles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* 2. My Posted Properties Option */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[
                  profileStyles.optionCard,
                  expandedSection === "my_properties" && profileStyles.optionCardActive,
                ]}
                onPress={() => toggleSection("my_properties")}
                activeOpacity={0.8}
              >
                <View style={[profileStyles.optionIconBox, { backgroundColor: "#ECFDF5" }]}>
                  <MaterialIcons name="real-estate-agent" size={22} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={profileStyles.optionTitle}>My posted properties</Text>
                  <Text style={profileStyles.optionSubtitle}>Manage listings, review status, and track verifications</Text>
                </View>
                <View style={profileStyles.countPill}>
                  <Text style={profileStyles.countPillText}>{myListings.data?.length ?? 0} Listed</Text>
                </View>
                <MaterialIcons
                  name={expandedSection === "my_properties" ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={24}
                  color={expandedSection === "my_properties" ? "#0A45B5" : "#94A3B8"}
                />
              </TouchableOpacity>

              {expandedSection === "my_properties" && (
                <View style={profileStyles.expandableBox}>
                  <View style={profileStyles.expandableHeader}>
                    <View style={{ gap: 2 }}>
                      <Text style={profileStyles.expandableTitle}>Your Property Portfolio</Text>
                      <Text style={{ fontSize: 13, color: "#64748B" }}>
                        {myListings.data?.length || 0} active listing(s) associated with this account
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={profileStyles.postNewBtn}
                      onPress={() => router.push("/post")}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="add" size={16} color="#FFFFFF" />
                      <Text style={profileStyles.postNewBtnText}>Post New</Text>
                    </TouchableOpacity>
                  </View>

                  {myListings.loading && (
                    <View style={{ padding: 20, alignItems: "center" }}>
                      <ActivityIndicator size="small" color="#0A45B5" />
                    </View>
                  )}

                  {!myListings.loading && myListings.data?.length > 0 && (
                    <View style={{ gap: 12 }}>
                      {myListings.data.map((p: any) => (
                        <View key={p._id} style={profileStyles.listingCardRow}>
                          {p.media?.photos?.[0] ? (
                            <Image
                              source={{ uri: p.media.photos[0] }}
                              style={profileStyles.listingThumbnail}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[profileStyles.listingThumbnail, { alignItems: "center", justifyContent: "center" }]}>
                              <MaterialIcons name="home-work" size={28} color="#94A3B8" />
                            </View>
                          )}
                          <View style={{ flex: 1, minWidth: 200, gap: 3 }}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B1B3F" }}>
                                {label(p)}
                              </Text>
                              <View style={[
                                profileStyles.approvedBadge,
                                { backgroundColor: p.status === "verified" ? "#ECFDF5" : "#EFF6FF", borderColor: p.status === "verified" ? "#A7F3D0" : "#DBEAFE" }
                              ]}>
                                <Text style={{ fontSize: 11, fontWeight: "700", color: p.status === "verified" ? "#059669" : "#0A45B5" }}>
                                  {p.status?.replaceAll("_", " ")?.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                            <Text style={{ fontSize: 12, color: "#64748B" }}>
                              {p.location?.district || "Bihar"} · {p.totalArea || "N/A"} sq ft
                            </Text>
                            <Text style={{ fontSize: 14, fontWeight: "800", color: "#0A45B5" }}>
                              {money(p.price)}
                            </Text>
                          </View>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            {["draft", "correction_required"].includes(p.status) && (
                              <TouchableOpacity
                                style={profileStyles.cancelBtn}
                                onPress={() => router.push({ pathname: "/post", params: { id: p._id } } as any)}
                              >
                                <MaterialIcons name="edit" size={14} color="#64748B" />
                                <Text style={profileStyles.cancelBtnText}>Edit</Text>
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={profileStyles.editProfileBtn}
                              onPress={() => router.push(`/verification/${p._id}` as any)}
                            >
                              <MaterialIcons name="timeline" size={14} color="#0A45B5" />
                              <Text style={profileStyles.editProfileBtnText}>Track</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {!myListings.loading && (!myListings.data || myListings.data.length === 0) && (
                    <View style={{ alignItems: "center", padding: 24, gap: 10 }}>
                      <MaterialIcons name="roofing" size={40} color="#94A3B8" />
                      <Text style={{ fontSize: 15, fontWeight: "700", color: "#0B1B3F" }}>
                        No properties listed yet
                      </Text>
                      <Text style={{ fontSize: 13, color: "#64748B", textAlign: "center", maxWidth: 360 }}>
                        List your plot, apartment, or commercial space with surveyor demarcation and Bihar revenue audit.
                      </Text>
                      <TouchableOpacity
                        style={[profileStyles.saveBtn, { marginTop: 6 }]}
                        onPress={() => router.push("/post")}
                      >
                        <MaterialIcons name="add" size={18} color="#FFFFFF" />
                        <Text style={profileStyles.saveBtnText}>Post Property Now</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* 3. Wishlist Option */}
            <TouchableOpacity
              style={profileStyles.optionCard}
              onPress={() => router.push("/saved")}
              activeOpacity={0.8}
            >
              <View style={[profileStyles.optionIconBox, { backgroundColor: "#FDF2F8" }]}>
                <MaterialIcons name="favorite-border" size={22} color="#DB2777" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={profileStyles.optionTitle}>Wishlist</Text>
                <Text style={profileStyles.optionSubtitle}>Your saved properties and inspection shortlist</Text>
              </View>
              <View style={[profileStyles.countPill, { backgroundColor: "#FDF2F8", borderColor: "#FCE7F3" }]}>
                <Text style={[profileStyles.countPillText, { color: "#DB2777" }]}>
                  {mySaved.data?.length ?? 0} Saved
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
            </TouchableOpacity>

            {/* 4. Identity Verification (KYC) Option */}
            <View style={{ gap: 10 }}>
              <TouchableOpacity
                style={[
                  profileStyles.optionCard,
                  expandedSection === "kyc" && profileStyles.optionCardActive,
                ]}
                onPress={() => toggleSection("kyc")}
                activeOpacity={0.8}
              >
                <View style={[profileStyles.optionIconBox, { backgroundColor: "#F5F3FF" }]}>
                  <MaterialIcons name="verified-user" size={22} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={profileStyles.optionTitle}>Identity verification</Text>
                  <Text style={profileStyles.optionSubtitle}>Submit and track government revenue KYC</Text>
                </View>
                <View style={isApproved ? profileStyles.approvedBadge : profileStyles.pendingBadge}>
                  <Text style={isApproved ? profileStyles.approvedBadgeText : profileStyles.pendingBadgeText}>
                    {isApproved ? "✓ Approved" : "Pending"}
                  </Text>
                </View>
                <MaterialIcons
                  name={expandedSection === "kyc" ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={24}
                  color={expandedSection === "kyc" ? "#0A45B5" : "#94A3B8"}
                />
              </TouchableOpacity>

              {expandedSection === "kyc" && (
                <View style={profileStyles.expandableBox}>
                  <View style={profileStyles.expandableHeader}>
                    <Text style={profileStyles.expandableTitle}>Bihar Land Law & Identity Verification</Text>
                    <TouchableOpacity onPress={() => setExpandedSection(null)}>
                      <MaterialIcons name="close" size={20} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <View style={[profileStyles.successBanner, { backgroundColor: isApproved ? "#ECFDF5" : "#FFFBEB", borderColor: isApproved ? "#A7F3D0" : "#FDE68A" }]}>
                    <MaterialIcons
                      name={isApproved ? "verified" : "info"}
                      size={20}
                      color={isApproved ? "#059669" : "#D97706"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: isApproved ? "#059669" : "#D97706" }}>
                        {isApproved ? "100% Certified On-Ground & Document Verified" : "Verification in Progress"}
                      </Text>
                      <Text style={{ fontSize: 12, color: isApproved ? "#047857" : "#B45309", marginTop: 2 }}>
                        {isApproved
                          ? "Your identity has been authenticated against government records. All properties posted from this account receive instant verified badges."
                          : "Please submit your verification documents to unlock fast deal closure and verified badges."}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={profileStyles.editProfileBtn}
                    onPress={() => router.push("/kyc")}
                  >
                    <MaterialIcons name="open-in-new" size={16} color="#0A45B5" />
                    <Text style={profileStyles.editProfileBtnText}>Open KYC Document Center</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* 5. Conversations Option */}
            <TouchableOpacity
              style={profileStyles.optionCard}
              onPress={() => router.push("/messages")}
              activeOpacity={0.8}
            >
              <View style={[profileStyles.optionIconBox, { backgroundColor: "#EFF6FF" }]}>
                <MaterialIcons name="chat-bubble-outline" size={22} color="#0A45B5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={profileStyles.optionTitle}>Conversations</Text>
                <Text style={profileStyles.optionSubtitle}>Direct chat with assigned advisor and verifier</Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
            </TouchableOpacity>

            {/* Staff Dashboard (if staff) */}
            {user.role !== "user" && dashboardRoutes[user.role] && (
              <TouchableOpacity
                style={profileStyles.optionCard}
                onPress={() => router.push(dashboardRoutes[user.role] as any)}
                activeOpacity={0.8}
              >
                <View style={[profileStyles.optionIconBox, { backgroundColor: "#FFF7ED" }]}>
                  <MaterialIcons name="dashboard" size={22} color="#EA580C" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={profileStyles.optionTitle}>Staff dashboard</Text>
                  <Text style={profileStyles.optionSubtitle}>Assigned work, queue inspections, and reviews</Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {/* Log out Button */}
            <TouchableOpacity
              style={profileStyles.logoutBtn}
              onPress={() =>
                action.run(async () => {
                  await authService.logout();
                  router.replace("/home");
                })
              }
              activeOpacity={0.8}
            >
              <MaterialIcons name="logout" size={18} color="#E11D48" />
              <Text style={profileStyles.logoutBtnText}>Log out of MalikSe</Text>
            </TouchableOpacity>
          </View>
        )}
      </Protected>
    </MarketplaceShell>
  );
}
export function ListingsScreen() {
  const user = useAuthStore((x) => x.user),
    router = useRouter(),
    feed = useData(user ? "/properties/mine" : null, [user?.id]);
  return (
    <MarketplaceShell
      title="Your Listings"
      subtitle="Manage your portfolio"
      back
    >
      <Protected>
        <View style={s.between}>
          <Tag>{feed.data?.length || 0} listings</Tag>
          <Button
            title="Post new"
            icon="add"
            onPress={() => router.push("/post")}
          />
        </View>
        <ErrorBox text={feed.error} />
        {feed.loading && <ActivityIndicator />}
        {feed.data?.map((p: any) => (
          <View key={p._id} style={s.panel}>
            <View style={s.between}>
              <Tag green={p.status === "verified"}>
                {p.status.replaceAll("_", " ")}
              </Tag>
              <Text style={s.small}>ID: {p._id.slice(-8)}</Text>
            </View>
            <Text style={s.h2}>{label(p)}</Text>
            <Text style={s.muted}>
              {p.location.district} · {p.totalArea} sq ft
            </Text>
            <Text style={s.price}>{money(p.price)}</Text>
            {!!p.rejectionReason && <ErrorBox text={p.rejectionReason} />}
            <View style={s.wrap}>
              {["draft", "correction_required"].includes(p.status) && (
                <Button
                  secondary
                  title="Edit listing"
                  icon="edit"
                  onPress={() =>
                    router.push({
                      pathname: "/post",
                      params: { id: p._id },
                    } as any)
                  }
                />
              )}
              <Button
                secondary
                title="Track verification"
                onPress={() => router.push(`/verification/${p._id}` as any)}
              />
            </View>
          </View>
        ))}
        {!!feed.nextCursor && (
          <Button
            title="Load more properties"
            secondary
            disabled={feed.loading}
            onPress={feed.loadMore}
          />
        )}
        {feed.data?.length === 0 && (
          <Empty
            title="Your first listing starts here"
            text="Create a draft, add details, and submit it to your assigned reviewer."
          />
        )}
      </Protected>
    </MarketplaceShell>
  );
}
export function KycScreen() {
  const user = useAuthStore((x) => x.user),
    router = useRouter(),
    params = useLocalSearchParams(),
    feed = useData(user ? "/users/kyc" : null, [user?.id]),
    [files, setFiles] = useState<DocumentPicker.DocumentPickerAsset[]>([]),
    action = useAction();
  return (
    <MarketplaceShell
      title="KYC Verification"
      subtitle="Verify your identity to sell, make offers and contact staff."
      back
    >
      <Protected>
        <View style={s.panel}>
          <View style={s.row}>
            <Icon name="verified-user" size={42} />
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>Verification status</Text>
              <Tag green={feed.data?.isVerifiedIdentity}>
                {feed.data?.isVerifiedIdentity
                  ? "Approved"
                  : (feed.data?.kycStatus || "not_submitted").replaceAll(
                      "_",
                      " ",
                    )}
              </Tag>
            </View>
          </View>
          <Text style={s.muted}>
            Your documents are private and reviewed by authorized staff.
            Submission does not automatically approve your identity.
          </Text>
          {!!feed.data?.identityReview?.notes && (
            <Text style={s.muted}>{feed.data.identityReview.notes}</Text>
          )}
        </View>
        <ErrorBox text={feed.error || action.error} />
        {!approved(user) && (
          <View style={[s.panel, { backgroundColor: "#F0F7FF", borderColor: "#C6DBFC" }]}>
            <View style={s.row}>
              <Icon name="bolt" size={28} color={C.blue} />
              <View style={{ flex: 1 }}>
                <Text style={[s.h2, { fontSize: 16 }]}>Quick Demo Verification</Text>
                <Text style={s.muted}>
                  In demo mode, you can instantly verify your seller account without waiting for manual document review.
                </Text>
              </View>
            </View>
            <Button
              title="Activate Instant Demo Verification"
              icon="verified"
              onPress={() =>
                action.run(async () => {
                  await authService.completeDemoKyc();
                  await feed.refresh();
                  if (params.returnTo) {
                    router.replace(params.returnTo as any);
                  }
                })
              }
            />
          </View>
        )}
        {!feed.data?.isVerifiedIdentity &&
          feed.data?.kycStatus !== "pending" && (
            <View style={s.panel}>
              <Text style={s.h2}>Identity documents</Text>
              <Text style={s.muted}>
                Upload clear identity documents. JPG, PNG or PDF, up to 5 MB
                each; maximum 3 files.
              </Text>
              <Button
                title="Choose documents"
                secondary
                icon="cloud-upload"
                onPress={() =>
                  action.run(async () => {
                    const result = await DocumentPicker.getDocumentAsync({
                      type: ["image/jpeg", "image/png", "application/pdf"],
                      multiple: true,
                      copyToCacheDirectory: true,
                    });
                    if (!result.canceled) setFiles(result.assets.slice(0, 3));
                  })
                }
              />
              {files.map((f) => (
                <Text key={f.uri} style={s.muted}>
                  {f.name}
                </Text>
              ))}
              <Button
                title="Submit KYC for review"
                disabled={action.busy || !files.length}
                onPress={() =>
                  action.run(async () => {
                    const form = new FormData();
                    for (const asset of files) {
                      const prepared = await prepareUpload(asset, true);
                      if (Platform.OS === "web")
                        form.append("files", prepared.file, prepared.name);
                      else form.append("files", prepared.file as any);
                    }
                    await api.post("/users/kyc", form, {
                      headers: { "Content-Type": "multipart/form-data" },
                      timeout: 120000,
                    });
                    setFiles([]);
                    await feed.refresh();
                  })
                }
              />
            </View>
          )}
        {(feed.data?.isVerifiedIdentity || approved(user)) && (
          <Button
            title="Continue"
            onPress={() => {
              void authService.getMe();
              router.replace(
                (typeof params.returnTo === "string" &&
                params.returnTo.startsWith("/") &&
                !params.returnTo.startsWith("//")
                  ? params.returnTo
                  : "/profile") as any,
              );
            }}
          />
        )}
      </Protected>
    </MarketplaceShell>
  );
}
export function PropertyDetailScreen() {
  const { id } = useLocalSearchParams(),
    router = useRouter(),
    gate = useGate(),
    feed = useData(id ? `/properties/${id}` : null),
    [amount, setAmount] = useState(""),
    [message, setMessage] = useState("I am interested in this property."),
    action = useAction(),
    p = feed.data;
  useEffect(() => {
    if (id)
      void api
        .post(`/recommendations/${id}/activity`, { kind: "view" })
        .catch(() => {});
  }, [id]);
  const offerRequest = useRef<{ amount: string; key: string } | null>(null);
  const contact = (offer = false) =>
    action.run(async () => {
      if (!gate(true)) return;
      if (offer && offerRequest.current?.amount !== amount)
        offerRequest.current = { amount, key: randomUUID() };
      const conversation = (
        await api.post("/inquiries", {
          propertyId: id,
          message,
          ...(offer
            ? {
                offerAmount: Number(amount),
                requestKey: offerRequest.current?.key,
              }
            : {}),
        })
      ).data;
      router.push({
        pathname: "/messages",
        params: { inquiryId: conversation._id },
      } as any);
    });
  return (
    <MarketplaceShell title="Property details" back>
      <ErrorBox text={feed.error || action.error} />
      {feed.loading && <ActivityIndicator />}
      {p && (
        <>
          <View
            style={[
              s.photo,
              { height: 340, borderRadius: 24, overflow: "hidden" },
            ]}
          >
            {p.media?.photos?.[0] ? (
              <Image
                source={{ uri: p.media.photos[0] }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, s.placeholder]}>
                <Icon name="home-work" size={70} />
              </View>
            )}
            <View style={s.imageTags}>
              <Tag green>✓ Verified property</Tag>
            </View>
          </View>
          {p.media?.photos?.length > 1 && (
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {p.media.photos.slice(1).map((uri: string) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={{ width: 180, height: 120, borderRadius: 14 }}
                />
              ))}
            </ScrollView>
          )}
          <View style={s.panel}>
            <Text style={[s.price, { fontSize: 32 }]}>{money(p.price)}</Text>
            <Text style={s.h1}>{label(p)}</Text>
            <Text style={s.muted}>
              ⌖ {p.location?.district}, {p.location?.state}
            </Text>
            <View style={s.wrap}>
              <Tag>{p.type}</Tag>
              <Tag>{p.sellableArea} sq ft</Tag>
              <Tag>{p.negotiable ? "Negotiable" : "Fixed price"}</Tag>
            </View>
          </View>
          <View style={s.panel}>
            <Text style={s.h2}>Overview & specifications</Text>
            <View style={s.wrap}>
              {[
                ["Total area", `${p.totalArea} sq ft`],
                ["Sellable area", `${p.sellableArea} sq ft`],
                [
                  "Possession",
                  p.disclosures?.possessionStatus || "Not specified",
                ],
                [
                  "Road width",
                  p.roadWidth ? `${p.roadWidth} ft` : "Not specified",
                ],
              ].map(([key, value]) => (
                <View key={key} style={s.spec}>
                  <Text style={s.small}>{key}</Text>
                  <Text style={s.cardTitle}>{value}</Text>
                </View>
              ))}
            </View>
            <Text style={s.muted}>
              {p.description ||
                "Contact the assigned team for more details about this property."}
            </Text>
          </View>
          <View style={s.panel}>
            <View style={s.row}>
              <Icon name="support-agent" size={36} />
              <View style={{ flex: 1 }}>
                <Text style={s.h2}>Your assigned property team</Text>
                <Text style={s.muted}>
                  An Advisor or Verifier handles questions, site visits and
                  negotiation.
                </Text>
              </View>
            </View>
            <Button
              title="Chat with assigned staff"
              icon="chat-bubble-outline"
              disabled={action.busy}
              onPress={() => contact()}
            />
          </View>
          <View style={s.map}>
            <VerifiedPropertyMap properties={[p]} onSelect={() => {}} />
          </View>
          <View style={s.panel}>
            <Text style={s.h2}>Make an offer</Text>
            <Text style={s.muted}>
              Your offer goes privately to the assigned Advisor or Verifier.
              Approved KYC is required.
            </Text>
            <Field
              title="Offer amount (₹)"
              numeric
              value={amount}
              onChangeText={setAmount}
            />
            <Field
              title="Message to assigned staff"
              value={message}
              onChangeText={setMessage}
              multiline
            />
            <Button
              title="Send offer"
              disabled={action.busy || !Number(amount) || Number(amount) <= 0}
              onPress={() => contact(true)}
            />
          </View>
        </>
      )}
    </MarketplaceShell>
  );
}
export function ChatsScreen() {
  const user = useAuthStore((x) => x.user),
    router = useRouter(),
    params = useLocalSearchParams(),
    [selected, setSelected] = useState(String(params.inquiryId || "")),
    [text, setText] = useState(""),
    feed = useData(user ? "/inquiries" : null, [user?.id]),
    chat = useData(user && selected ? `/inquiries/${selected}` : null, [
      user?.id,
    ]),
    messages = useData(
      user && selected ? `/inquiries/${selected}/messages` : null,
      [user?.id],
    ),
    action = useAction();
  useEffect(() => {
    if (params.inquiryId) setSelected(String(params.inquiryId));
  }, [params.inquiryId]);
  useEffect(() => {
    if (!selected || !user) return;
    const timer = setInterval(() => {
      void messages.refresh();
      void chat.refresh();
    }, 7000);
    return () => clearInterval(timer);
  }, [selected, user?.id, messages.refresh, chat.refresh]);
  useEffect(() => {
    if (chat.data && messages.data) {
      const latest =
        messages.data.messages?.at(-1)?.createdAt || chat.data.createdAt;
      if (latest)
        void api
          .post(`/inquiries/${selected}/read`, { through: latest })
          .catch(() => {});
    }
  }, [messages.data, chat.data?.createdAt]);
  const c = chat.data,
    other = c && (identity(c.buyerId) === user?.id ? c.staffId : c.buyerId);
  return (
    <MarketplaceShell
      title={selected ? "Property conversation" : "Conversations"}
      subtitle="Private conversations with your assigned Advisor or Verifier."
      back
    >
      <Protected>
        <ErrorBox
          text={feed.error || chat.error || messages.error || action.error}
        />
        {selected ? (
          <>
            <Button
              title="All conversations"
              secondary
              onPress={() => setSelected("")}
            />
            {c && (
              <>
                <View style={[s.panel, s.row]}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{other?.name?.[0] || "A"}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.h2}>{other?.name || "Assigned staff"}</Text>
                    <Text style={s.small}>
                      {c.propertyId?.title || "Property conversation"}
                    </Text>
                  </View>
                  <Tag green>
                    {c.propertyId?.status === "sold" ? "Sold" : c.status}
                  </Tag>
                </View>
                {!!c.dealId && (
                  <Button
                    title="View offer & deal"
                    secondary
                    onPress={() =>
                      router.push(`/deal/${identity(c.dealId)}` as any)
                    }
                  />
                )}
                <View style={s.chatArea}>
                  <View
                    style={[
                      s.bubble,
                      identity(c.buyerId) === user?.id ? s.mine : s.theirs,
                    ]}
                  >
                    <Text style={s.body}>{c.message}</Text>
                    {!!c.offerAmount && (
                      <Text style={s.cardTitle}>
                        Offer: {money(c.offerAmount)}
                      </Text>
                    )}
                  </View>
                  {messages.data?.nextBefore != null && (
                    <Button
                      secondary
                      title="Load earlier messages"
                      onPress={() =>
                        action.run(async () => {
                          const older = (
                            await api.get(`/inquiries/${selected}/messages`, {
                              params: { before: messages.data.nextBefore },
                            })
                          ).data;
                          messages.setData({
                            messages: [
                              ...older.messages,
                              ...messages.data.messages,
                            ],
                            nextBefore: older.nextBefore,
                          });
                        })
                      }
                    />
                  )}
                  {messages.data?.messages?.map((m: any, i: number) => (
                    <View
                      key={m._id || i}
                      style={[
                        s.bubble,
                        identity(m.senderId) === user?.id ? s.mine : s.theirs,
                      ]}
                    >
                      <Text style={s.body}>{m.text}</Text>
                      <Text style={s.small}>
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  ))}
                </View>
                {c.propertyId?.status === "sold" ? (
                  <Tag>This property is sold. Conversation is read-only.</Tag>
                ) : (
                  <View style={s.row}>
                    <TextInput
                      accessibilityLabel="Message"
                      value={text}
                      onChangeText={setText}
                      style={[s.input, { flex: 1 }]}
                      placeholder="Write a message…"
                      multiline
                    />
                    <Button
                      title="Send"
                      icon="send"
                      disabled={action.busy || !text.trim()}
                      onPress={() =>
                        action.run(async () => {
                          await api.post(`/inquiries/${selected}/message`, {
                            text,
                          });
                          setText("");
                          await messages.refresh();
                        })
                      }
                    />
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          <>
            {feed.loading && <ActivityIndicator />}
            {feed.data?.map((c: any) => {
              const staff = identity(c.buyerId) === user?.id,
                other = staff ? c.staffId : c.buyerId;
              return (
                <Pressable
                  key={c._id}
                  onPress={() => setSelected(c._id)}
                  style={[s.panel, s.row]}
                >
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{other?.name?.[0] || "A"}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <View style={s.between}>
                      <Text style={s.cardTitle}>
                        {other?.name || "Property team"}
                      </Text>
                      <Tag green>{staff ? "Assigned staff" : "Buyer"}</Tag>
                    </View>
                    <Text style={s.muted} numberOfLines={2}>
                      {c.messages?.at(-1)?.text || c.message}
                    </Text>
                    <Text style={s.small}>{c.propertyId?.title}</Text>
                  </View>
                  {c.unread && <View style={s.dot} />}
                </Pressable>
              );
            })}
            {!!feed.nextCursor && (
              <Button
                title="Load more properties"
                secondary
                disabled={feed.loading}
                onPress={feed.loadMore}
              />
            )}
            {feed.data?.length === 0 && (
              <Empty
                title="Start a conversation"
                text="Open a verified property and contact its assigned team."
              />
            )}
          </>
        )}
      </Protected>
    </MarketplaceShell>
  );
}
export function DealScreen() {
  const { id } = useLocalSearchParams(),
    user = useAuthStore((x) => x.user),
    feed = useData(user && id ? `/deals/${id}` : null, [user?.id]),
    [counter, setCounter] = useState(""),
    [confirm, setConfirm] = useState(false),
    action = useAction(),
    d = feed.data,
    staff = d && (identity(d.staffId) === user?.id || user?.role === "admin");
  const ownProposal =
    d?.history
      ?.filter((h: any) => ["offered", "countered"].includes(h.status))
      .at(-1)?.actorId === user?.id;
  const update = (status: string) =>
    action.run(async () => {
      await api.patch(`/deals/${id}/status`, {
        status,
        ...(status === "countered" ? { counterAmount: Number(counter) } : {}),
      });
      setConfirm(false);
      await feed.refresh();
    });
  return (
    <MarketplaceShell title="Offer & deal" back>
      <Protected>
        <ErrorBox text={feed.error || action.error} />
        {d && (
          <View style={s.panel}>
            <Tag>{d.status.replaceAll("_", " ")}</Tag>
            <Text style={s.h2}>{d.propertyId?.title || "Property deal"}</Text>
            <Text style={s.price}>
              {money(d.counterAmount || d.offerAmount)}
            </Text>
            <Text style={s.muted}>
              Assigned staff: {d.staffId?.name || "Property team"}
            </Text>
            {staff && ["offered", "countered"].includes(d.status) && (
              <>
                <Field
                  title="Counteroffer amount (₹)"
                  value={counter}
                  onChangeText={setCounter}
                  numeric
                />
                <View style={s.wrap}>
                  <Button
                    title="Accept & reserve"
                    disabled={action.busy || ownProposal}
                    onPress={() => update("accepted")}
                  />
                  <Button
                    secondary
                    title="Reject offer"
                    disabled={action.busy}
                    onPress={() => update("rejected")}
                  />
                  <Button
                    secondary
                    title="Send counteroffer"
                    disabled={action.busy || Number(counter) <= 0 || !counter}
                    onPress={() => update("countered")}
                  />
                </View>
              </>
            )}
            {!staff && d.status === "countered" && (
              <View style={s.wrap}>
                <Button
                  title="Accept counteroffer"
                  disabled={action.busy || ownProposal}
                  onPress={() => update("accepted")}
                />
                <Button
                  secondary
                  title="Reject counteroffer"
                  onPress={() => update("rejected")}
                />
              </View>
            )}
            {!staff && d.status === "countered" && (
              <View style={s.panel}>
                <Field
                  title="Your revised offer (₹)"
                  value={counter}
                  onChangeText={setCounter}
                  numeric
                />
                <Button
                  title="Send revised offer"
                  disabled={action.busy || !counter || Number(counter) <= 0}
                  onPress={() => update("countered")}
                />
              </View>
            )}
            {["offered", "countered", "accepted", "token_paid"].includes(
              d.status,
            ) && (
              <Button
                title="Cancel offer / reservation"
                secondary
                disabled={action.busy}
                onPress={() => update("cancelled")}
              />
            )}
            {staff && ["accepted", "token_paid"].includes(d.status) && (
              <View style={s.panel}>
                <Text style={s.cardTitle}>Confirm the completed sale</Text>
                <Text style={s.muted}>
                  Only confirm once the deal is complete. This removes the
                  property from the marketplace and closes competing offers.
                </Text>
                <Button
                  title={
                    confirm
                      ? "Confirm sale and mark sold"
                      : "Close completed deal"
                  }
                  disabled={action.busy}
                  onPress={() =>
                    confirm ? update("completed") : setConfirm(true)
                  }
                />
              </View>
            )}
            {d.history?.map((h: any, i: number) => (
              <View key={i} style={s.history}>
                <Text style={s.cardTitle}>{h.status.replaceAll("_", " ")}</Text>
                <Text style={s.small}>
                  {new Date(h.at).toLocaleString()}
                  {h.amount ? " · " + money(h.amount) : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Protected>
    </MarketplaceShell>
  );
}
const BIHAR_DISTRICTS = [
  { name: "Patna", lat: "25.5941", lng: "85.1376", pincode: "800001" },
  { name: "Gaya", lat: "24.7914", lng: "85.0002", pincode: "823001" },
  { name: "Muzaffarpur", lat: "26.1209", lng: "85.3647", pincode: "842001" },
  { name: "Bhagalpur", lat: "25.2425", lng: "86.9842", pincode: "812001" },
  { name: "Darbhanga", lat: "26.1542", lng: "85.8918", pincode: "846004" },
  { name: "Purnia", lat: "25.7771", lng: "87.4753", pincode: "854301" },
  { name: "Begusarai", lat: "25.4182", lng: "86.1272", pincode: "851101" },
  { name: "Vaishali", lat: "25.6833", lng: "85.2167", pincode: "844101" },
];

const SAMPLE_PROPERTY_PHOTO = "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200";

const defaultPostForm = {
  title: "",
  description: "",
  type: "land",
  state: "",
  district: "",
  block: "",
  pincode: "",
  lat: "25.5941",
  lng: "85.1376",
  price: "",
  totalArea: "",
  sellableArea: "",
  boundary: "",
  roadWidth: "",
  requestedAdvisorId: "",
  negotiable: true,
  hasLoan: false,
  hasDispute: false,
  possessionStatus: "Immediate",
  media: { photos: [], videos: [] },
};

const postCategories = [
  {
    id: "land",
    title: "Plot / Land",
    sub: "Residential & Commercial",
    icon: "landscape",
  },
  {
    id: "flat",
    title: "Flat / Apartment",
    sub: "Flats & Builder Floors",
    icon: "apartment",
  },
  {
    id: "house",
    title: "House / Villa",
    sub: "Independent Houses",
    icon: "home",
  },
  {
    id: "shop",
    title: "Commercial Shop",
    sub: "Shops & Showrooms",
    icon: "storefront",
  },
  {
    id: "office",
    title: "Office Space",
    sub: "Offices & Workspaces",
    icon: "business",
  },
];

const postSteps = [
  { num: 1, label: "Category & Title", icon: "category" },
  { num: 2, label: "Location & GPS", icon: "place" },
  { num: 3, label: "Price & Area", icon: "payments" },
  { num: 4, label: "Photos & Docs", icon: "photo-library" },
  { num: 5, label: "Review & Submit", icon: "verified" },
];

export function PostScreen() {
  const router = useRouter(),
    params = useLocalSearchParams(),
    user = useAuthStore((x) => x.user),
    { width } = useWindowDimensions(),
    isDesktop = width >= 768,
    [draftId, setDraftId] = useState(String(params.id || "")),
    [step, setStep] = useState(1),
    [done, setDone] = useState(false),
    [consent, setConsent] = useState(false),
    [points, setPoints] = useState<LatLngPoint[]>([]),
    [photos, setPhotos] = useState<DocumentPicker.DocumentPickerAsset[]>([]),
    [documents, setDocuments] = useState<DocumentPicker.DocumentPickerAsset[]>([]),
    [form, setForm] = useState<any>(defaultPostForm),
    [pincodeLoading, setPincodeLoading] = useState(false),
    [pincodeStatus, setPincodeStatus] = useState<{ message: string; isError?: boolean } | null>(null),
    action = useAction();

  const set = (key: string) => (value: any) =>
    setForm((f: any) => ({ ...f, [key]: value }));

  const lookupPincode = useCallback(async (code: string) => {
    if (code.length !== 6) {
      setPincodeStatus(null);
      return;
    }

    setPincodeLoading(true);
    setPincodeStatus({ message: "Auto-detecting City & State across India..." });

    try {
      // 1. Fast local cache check for instant feedback
      const localMatch = BIHAR_DISTRICTS.find((d) => d.pincode === code);
      if (localMatch) {
        setForm((f: any) => ({
          ...f,
          district: localMatch.name,
          state: "Bihar",
          lat: (!f.lat || f.lat === "25.5941") ? localMatch.lat : f.lat,
          lng: (!f.lng || f.lng === "85.1376") ? localMatch.lng : f.lng,
        }));
      }

      // 2. Authoritative India Post PIN Code API lookup
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);

      const res = await fetch(`https://api.postalpincode.in/pincode/${code}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error("Network request failed");
      const data = await res.json();

      if (
        data &&
        Array.isArray(data) &&
        data[0]?.Status === "Success" &&
        Array.isArray(data[0]?.PostOffice) &&
        data[0].PostOffice.length > 0
      ) {
        const po = data[0].PostOffice[0];
        const districtName = po.District || "";
        const stateName = po.State || "";
        const blockName =
          po.Block && po.Block !== "NA"
            ? po.Block
            : po.Name && po.Name !== districtName
            ? po.Name
            : "";

        setForm((f: any) => ({
          ...f,
          district: districtName || f.district,
          state: stateName || f.state,
          block: f.block || blockName,
        }));

        setPincodeStatus({
          message: `✓ Auto-filled: ${districtName ? districtName + ", " : ""}${stateName}`,
          isError: false,
        });
      } else {
        if (localMatch) {
          setPincodeStatus({
            message: `✓ Auto-filled: ${localMatch.name}, Bihar`,
            isError: false,
          });
        } else {
          setPincodeStatus({
            message: "Pincode not found. Please enter City & State manually.",
            isError: true,
          });
        }
      }
    } catch {
      const localMatch = BIHAR_DISTRICTS.find((d) => d.pincode === code);
      if (localMatch) {
        setForm((f: any) => ({
          ...f,
          district: localMatch.name,
          state: "Bihar",
        }));
        setPincodeStatus({
          message: `✓ Auto-filled: ${localMatch.name}, Bihar`,
          isError: false,
        });
      } else {
        setPincodeStatus({
          message: "Could not auto-fetch. Please enter City and State manually.",
          isError: true,
        });
      }
    } finally {
      setPincodeLoading(false);
    }
  }, []);

  const handlePincodeChange = (text: string) => {
    const clean = text.replace(/[^0-9]/g, "").slice(0, 6);
    setForm((f: any) => ({ ...f, pincode: clean }));
    if (clean.length === 6) {
      void lookupPincode(clean);
    } else {
      setPincodeStatus(null);
    }
  };

  const onParcelChange = useCallback((next: LatLngPoint[]) => {
    setPoints(next);
    if (next.length) {
      setForm((f: any) => ({
        ...f,
        lat: String(next[0].lat),
        lng: String(next[0].lng),
      }));
    }
  }, []);

  useEffect(() => {
    if (params.id && user)
      void action.run(async () => {
        const p = (await api.get(`/properties/${params.id}/workspace`)).data;
        if (p.parcelPoints && Array.isArray(p.parcelPoints)) {
          setPoints(p.parcelPoints);
        }
        setForm({
          ...p,
          ...p.location,
          ...p.disclosures,
          price: String(p.price || ""),
          totalArea: String(p.totalArea || ""),
          sellableArea: String(p.sellableArea || p.totalArea || ""),
          lat: String(p.location?.lat || "25.5941"),
          lng: String(p.location?.lng || "85.1376"),
          boundary: p.boundary || "",
          roadWidth: p.roadWidth ? String(p.roadWidth) : "",
          requestedAdvisorId: p.requestedAdvisorId || "",
          media: p.media || { photos: [], videos: [] },
        });
      });
  }, [params.id, user?.id]);

  const pick = async (doc = false) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: doc
        ? ["application/pdf", "image/jpeg", "image/png"]
        : ["image/jpeg", "image/png", "image/webp"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets) {
      if (doc) {
        setDocuments((current) => [...current, ...result.assets]);
      } else {
        setPhotos((current) => [...current, ...result.assets]);
      }
    }
  };

  const addSamplePhoto = () => {
    setForm((f: any) => ({
      ...f,
      media: {
        ...f.media,
        photos: [...(f.media?.photos || []), SAMPLE_PROPERTY_PHOTO],
      },
    }));
  };

  const removePhoto = (index: number, isLocal: boolean) => {
    if (isLocal) {
      setPhotos((current) => current.filter((_, i) => i !== index));
    } else {
      setForm((f: any) => ({
        ...f,
        media: {
          ...f.media,
          photos: f.media.photos.filter((_: any, i: number) => i !== index),
        },
      }));
    }
  };

  const removeDocument = (index: number) => {
    setDocuments((current) => current.filter((_, i) => i !== index));
  };

  const uploadKeys = useRef(new Map<string, string>());
  const uploadKey = (uri: string) => {
    if (!uploadKeys.current.has(uri)) uploadKeys.current.set(uri, randomUUID());
    return uploadKeys.current.get(uri)!;
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/home");
    }
  };

  const goToNextStep = () => {
    if (step === 1) {
      if (!form.title || !form.title.trim()) {
        action.run(async () => {
          throw new Error("Please enter a property title before continuing.");
        });
        return;
      }
    }
    if (step === 2) {
      if (!form.district || !form.district.trim()) {
        action.run(async () => {
          throw new Error("Please enter your Pincode or City / District before continuing.");
        });
        return;
      }
      if (!form.lat || !form.lng) {
        setForm((f: any) => ({ ...f, lat: "25.5941", lng: "85.1376" }));
      }
    }
    if (step === 3) {
      if (!form.price || Number(form.price) <= 0) {
        action.run(async () => {
          throw new Error("Please enter a valid price greater than ₹0.");
        });
        return;
      }
      if (!form.totalArea || Number(form.totalArea) <= 0) {
        action.run(async () => {
          throw new Error("Please enter total area in sq ft.");
        });
        return;
      }
      if (!form.sellableArea) {
        setForm((f: any) => ({ ...f, sellableArea: f.totalArea }));
      } else if (Number(form.sellableArea) > Number(form.totalArea)) {
        action.run(async () => {
          throw new Error("Sellable area cannot exceed total area.");
        });
        return;
      }
    }
    if (step === 4) {
      if (!photos.length && (!form.media?.photos || !form.media.photos.length)) {
        action.run(async () => {
          throw new Error("Please add at least one property photo before continuing.");
        });
        return;
      }
    }
    setStep(step + 1);
  };

  const submit = () =>
    action.run(async () => {
      if (!consent)
        throw new Error("Please accept the seller declaration before submitting.");
      if (points.length > 0 && points.length < 3)
        throw new Error("Complete the boundary with at least 3 points, or clear it.");
      if (!form.title || !form.title.trim())
        throw new Error("Please enter a property title.");
      if (!form.district || !form.district.trim())
        throw new Error("Please enter City / District.");
      if (!form.lat || !form.lng)
        throw new Error("Please set property location coordinates.");
      if (!form.price || Number(form.price) <= 0)
        throw new Error("Please enter a valid price.");
      if (!form.totalArea || Number(form.totalArea) <= 0)
        throw new Error("Please enter total area.");
      if (!photos.length && (!form.media?.photos || !form.media.photos.length))
        throw new Error("Please add at least one property photo before submitting.");

      // Ensure demo KYC is completed in non-production if not already verified
      if (!approved(user)) {
        try {
          await authService.completeDemoKyc();
        } catch {
          // Continue and let server validate
        }
      }

      const payload = {
        title: form.title.trim(),
        description: form.description ? form.description.trim() : undefined,
        type: form.type,
        location: {
          state: form.state?.trim() || "Bihar",
          district: form.district?.trim() || "Patna",
          block: form.block ? form.block.trim() : undefined,
          pincode: form.pincode ? form.pincode.trim() : undefined,
          lat: Number(form.lat || 25.5941),
          lng: Number(form.lng || 85.1376),
        },
        price: Number(form.price),
        totalArea: Number(form.totalArea),
        sellableArea: Number(form.sellableArea || form.totalArea),
        boundary: form.boundary ? form.boundary.trim() : undefined,
        roadWidth: form.roadWidth ? Number(form.roadWidth) : undefined,
        parcelPoints: points.length ? points : undefined,
        requestedAdvisorId: form.requestedAdvisorId ? form.requestedAdvisorId.trim() : undefined,
        negotiable: Boolean(form.negotiable),
        disclosures: {
          hasLoan: Boolean(form.hasLoan),
          hasDispute: Boolean(form.hasDispute),
          possessionStatus: form.possessionStatus || "Immediate",
        },
        media: form.media || { photos: [], videos: [] },
      };

      let id = draftId;
      if (id) {
        await api.patch(`/properties/${id}`, payload);
      } else {
        const createRes = await api.post("/properties", payload);
        id = createRes.data._id;
        setDraftId(id);
      }

      for (const asset of photos) {
        const prepared = await prepareUpload(asset, false);
        const body = new FormData();
        body.append("uploadId", uploadKey(asset.uri));
        if (Platform.OS === "web") {
          body.append("file", prepared.file, prepared.name);
        } else {
          body.append("file", prepared.file as any);
        }
        const result = await api.post(`/properties/${id}/photos`, body, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        });
        setForm((f: any) => ({
          ...f,
          media: { ...f.media, photos: [...(f.media?.photos || []), result.data.url] },
        }));
        setPhotos((current) => current.filter((a) => a.uri !== asset.uri));
      }

      for (const asset of documents) {
        const prepared = await prepareUpload(asset, true);
        const body = new FormData();
        body.append("uploadId", uploadKey(asset.uri));
        body.append("propertyId", id);
        body.append("type", "Registry");
        if (Platform.OS === "web") {
          body.append("file", prepared.file, prepared.name);
        } else {
          body.append("file", prepared.file as any);
        }
        await api.post("/documents", body, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        });
        setDocuments((current) => current.filter((a) => a.uri !== asset.uri));
      }

      await api.post(`/properties/${id}/submit`, { consent: true });
      setDone(true);
    });

  const katthaApprox = form.totalArea && Number(form.totalArea) > 0
    ? (Number(form.totalArea) / 1361.25).toFixed(2)
    : null;

  return (
    <MarketplaceShell back={false}>
      {!user ? (
        <View style={postStyles.cardContainer}>
          <View style={{ alignItems: "center", paddingVertical: 36, gap: 16 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#EBF2FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="add-business" size={36} color="#0A45B5" />
            </View>
            <Text style={[postStyles.cardHeaderTitle, { textAlign: "center", fontSize: 28 }]}>
              List Your Property on MalikSe
            </Text>
            <Text
              style={{
                textAlign: "center",
                color: "#475A82",
                maxWidth: 540,
                lineHeight: 24,
                fontSize: 15,
              }}
            >
              Connect directly with verified buyers across Bihar. Enjoy 0% brokerage, legal deed audit, and on-ground GPS boundary demarcation with your assigned property team.
            </Text>

            <View style={{ flexDirection: "row", gap: 12, marginVertical: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <View style={postStyles.trustMiniBadge}>
                <MaterialIcons name="verified" size={16} color="#0A45B5" />
                <Text style={postStyles.trustMiniBadgeText}>Verified Title Checks</Text>
              </View>
              <View style={[postStyles.trustMiniBadge, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                <MaterialIcons name="check-circle" size={16} color="#059669" />
                <Text style={[postStyles.trustMiniBadgeText, { color: "#059669" }]}>0% Brokerage</Text>
              </View>
              <View style={[postStyles.trustMiniBadge, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <MaterialIcons name="place" size={16} color="#B45309" />
                <Text style={[postStyles.trustMiniBadgeText, { color: "#B45309" }]}>GPS Demarcated</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              <TouchableOpacity
                style={postStyles.primaryBtnLg}
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: { returnTo: "/post" },
                  } as any)
                }
              >
                <MaterialIcons name="login" size={18} color="#FFFFFF" />
                <Text style={postStyles.primaryBtnLgText}>Sign In to Post Property</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={postStyles.secondaryBtnLg}
                onPress={() =>
                  router.push({
                    pathname: "/register",
                    params: { returnTo: "/post" },
                  } as any)
                }
              >
                <MaterialIcons name="person-add" size={18} color="#0A45B5" />
                <Text style={postStyles.secondaryBtnLgText}>Create Free Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : user.role !== "user" ? (
        <View style={postStyles.cardContainer}>
          <Text style={postStyles.cardHeaderTitle}>Staff Account Notice</Text>
          <Text style={{ color: "#475A82", fontSize: 15, marginVertical: 8 }}>
            Property posting is available for User accounts (buyers & sellers). You are currently logged in with a staff account ({user.role}).
          </Text>
          <TouchableOpacity
            style={[postStyles.primaryBtnLg, { alignSelf: "flex-start", marginTop: 12 }]}
            onPress={() =>
              router.push((dashboardRoutes[user.role] || "/dashboard") as any)
            }
          >
            <Text style={postStyles.primaryBtnLgText}>Go to Staff Dashboard</Text>
          </TouchableOpacity>
        </View>
      ) : done ? (
        <View style={postStyles.cardContainer}>
          <View style={{ alignItems: "center", paddingVertical: 36, gap: 16 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: "#DCFCE7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MaterialIcons name="check-circle" size={42} color="#15803D" />
            </View>
            <Text style={[postStyles.cardHeaderTitle, { fontSize: 26, textAlign: "center" }]}>
              Property Submitted Successfully!
            </Text>
            <Text style={{ textAlign: "center", maxWidth: 540, lineHeight: 24, color: "#475A82", fontSize: 15 }}>
              Your listing has been safely registered and placed in review. Your assigned Advisor or Verifier will review legal details and coordinate on-ground cadastral demarcation.
            </Text>
            <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap", justifyContent: "center", marginTop: 14 }}>
              <TouchableOpacity
                style={postStyles.primaryBtnLg}
                onPress={() => router.replace("/my-properties")}
              >
                <MaterialIcons name="list-alt" size={18} color="#FFFFFF" />
                <Text style={postStyles.primaryBtnLgText}>View My Listings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={postStyles.secondaryBtnLg}
                onPress={() => {
                  setDone(false);
                  setStep(1);
                  setForm(defaultPostForm);
                  setPoints([]);
                  setPhotos([]);
                  setDocuments([]);
                  setConsent(false);
                  setDraftId("");
                }}
              >
                <MaterialIcons name="add" size={18} color="#0A45B5" />
                <Text style={postStyles.secondaryBtnLgText}>Post Another Property</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={postStyles.pageContainer}>
          {/* Top Row: Back button (relocated here) & Trust Badges */}
          <View style={postStyles.topNavRow}>
            <TouchableOpacity
              style={postStyles.backButtonPill}
              onPress={handleBack}
              activeOpacity={0.8}
            >
              <MaterialIcons name="arrow-back" size={18} color="#0A45B5" />
              <Text style={postStyles.backButtonPillText}>
                {step > 1 ? `Back to Step ${step - 1}` : "Back to Home"}
              </Text>
            </TouchableOpacity>

            <View style={postStyles.verifiedBadgePill}>
              <MaterialIcons name="verified-user" size={15} color="#0A45B5" />
              <Text style={postStyles.verifiedBadgeText}>
                {isDesktop ? "100% On-Ground & Document-Verified Spaces" : "Verified Portal"}
              </Text>
            </View>
          </View>

          {/* Hero Header Block */}
          <View style={postStyles.heroHeaderRow}>
            <View style={{ gap: 4, flex: 1 }}>
              <Text style={postStyles.heroTitle}>Post Your Property in Bihar</Text>
              <Text style={postStyles.heroSubtitle}>
                Step {step} of 5 · Private & confidential until verified by your assigned Advisor
              </Text>
            </View>
            {isDesktop && (
              <View style={postStyles.zeroBrokerageBadge}>
                <MaterialIcons name="handshake" size={16} color="#059669" />
                <Text style={postStyles.zeroBrokerageText}>Zero Brokerage</Text>
              </View>
            )}
          </View>

          {/* Premium Stepper Wizard */}
          <View style={postStyles.stepperContainer}>
            {postSteps.map((st, idx) => {
              const isActive = step === st.num;
              const isCompleted = step > st.num;
              return (
                <React.Fragment key={st.num}>
                  <TouchableOpacity
                    onPress={() => {
                      if (st.num < step) setStep(st.num);
                    }}
                    disabled={st.num > step}
                    style={postStyles.stepItem}
                    activeOpacity={st.num < step ? 0.7 : 1}
                  >
                    <View
                      style={[
                        postStyles.stepCircle,
                        isActive && postStyles.stepCircleActive,
                        isCompleted && postStyles.stepCircleCompleted,
                      ]}
                    >
                      {isCompleted ? (
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      ) : (
                        <Text
                          style={[
                            postStyles.stepCircleText,
                            isActive && postStyles.stepCircleTextActive,
                          ]}
                        >
                          {st.num}
                        </Text>
                      )}
                    </View>
                    {isDesktop && (
                      <View style={postStyles.stepTextCol}>
                        <Text
                          style={[
                            postStyles.stepLabel,
                            isActive && postStyles.stepLabelActive,
                            isCompleted && postStyles.stepLabelCompleted,
                          ]}
                          numberOfLines={1}
                        >
                          {st.label}
                        </Text>
                        <Text style={postStyles.stepSubLabel}>
                          {isCompleted ? "Completed" : isActive ? "Active" : `Step ${st.num}`}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {idx < postSteps.length - 1 && (
                    <View
                      style={[
                        postStyles.stepConnectorLine,
                        isCompleted && postStyles.stepConnectorLineCompleted,
                      ]}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </View>

          <ErrorBox text={action.error} />

          {/* Main Card Container */}
          <View style={postStyles.cardContainer}>
            {/* STEP 1: Property Type & Title */}
            {step === 1 && (
              <View style={{ gap: 24 }}>
                <View style={{ gap: 4 }}>
                  <Text style={postStyles.cardHeaderTitle}>What type of property are you listing?</Text>
                  <Text style={postStyles.cardHeaderSubtitle}>
                    Select your property category to configure the right verification and cadastral parameters.
                  </Text>
                </View>

                {/* 5 Property Category Cards */}
                <View style={postStyles.categoryGrid}>
                  {postCategories.map((cat) => {
                    const isSelected = form.type === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          postStyles.categoryCard,
                          isSelected && postStyles.categoryCardSelected,
                        ]}
                        onPress={() => set("type")(cat.id)}
                        activeOpacity={0.85}
                      >
                        {isSelected && (
                          <View style={postStyles.categoryCheckBadge}>
                            <MaterialIcons name="check" size={12} color="#FFFFFF" />
                          </View>
                        )}
                        <View
                          style={[
                            postStyles.categoryIconBox,
                            isSelected && postStyles.categoryIconBoxSelected,
                          ]}
                        >
                          <MaterialIcons
                            name={cat.icon as any}
                            size={24}
                            color={isSelected ? "#FFFFFF" : "#0A45B5"}
                          />
                        </View>
                        <View style={postStyles.categoryTextWrapper}>
                          <Text
                            style={[
                              postStyles.categoryCardTitle,
                              isSelected && postStyles.categoryCardTitleSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {cat.title}
                          </Text>
                          <Text
                            style={[
                              postStyles.categoryCardSub,
                              isSelected && postStyles.categoryCardSubSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {cat.sub}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={{ gap: 16, marginTop: 4 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={postStyles.inputLabel}>
                      Property Title <Text style={{ color: "#EF4444" }}>*</Text>
                    </Text>
                    <TextInput
                      style={postStyles.customInput}
                      placeholder="e.g. 2,400 sq ft Commercial Corner Plot on 40ft Main Road, Bailey Road"
                      placeholderTextColor="#94A3B8"
                      value={form.title}
                      onChangeText={set("title")}
                    />
                    <Text style={postStyles.inputHelperText}>
                      A clear, specific title gets up to 3x more views from verified buyers.
                    </Text>
                  </View>

                  <View style={{ gap: 6 }}>
                    <Text style={postStyles.inputLabel}>Property Description</Text>
                    <TextInput
                      style={[postStyles.customInput, { minHeight: 110, textAlignVertical: "top" }]}
                      placeholder="Provide details about road access, boundary walls, plot frontage, distance from main road, utilities, and registry documents..."
                      placeholderTextColor="#94A3B8"
                      value={form.description}
                      onChangeText={set("description")}
                      multiline
                    />
                    <Text style={postStyles.inputHelperText}>
                      Mention key details like connectivity, nearby hospitals/schools, and water/electricity.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 2: Location & GPS Demarcation */}
            {step === 2 && (
              <View style={{ gap: 20 }}>
                <View style={{ gap: 4 }}>
                  <Text style={postStyles.cardHeaderTitle}>Where is your property located?</Text>
                  <Text style={postStyles.cardHeaderSubtitle}>
                    Enter your 6-digit Indian Pincode to auto-fill City and State, then confirm coordinates for on-ground surveyor demarcation.
                  </Text>
                </View>

                {/* Address inputs */}
                <View style={postStyles.formRowTwoCol}>
                  {/* Pincode with Auto-fill */}
                  <View style={{ flex: 1, minWidth: 260, gap: 6 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={postStyles.inputLabel}>
                        Pincode <Text style={{ color: "#EF4444" }}>*</Text>
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <MaterialIcons name="bolt" size={14} color="#0A45B5" />
                        <Text style={{ fontSize: 11, fontWeight: "700", color: "#0A45B5" }}>
                          Auto-fills City & State
                        </Text>
                      </View>
                    </View>
                    <View style={postStyles.pincodeInputWrapper}>
                      <TextInput
                        style={[postStyles.customInput, postStyles.pincodeInput]}
                        placeholder="e.g. 800001 or 110001"
                        placeholderTextColor="#94A3B8"
                        value={form.pincode}
                        onChangeText={handlePincodeChange}
                        keyboardType="numeric"
                        maxLength={6}
                      />
                      <View style={postStyles.pincodeIconBadge}>
                        {pincodeLoading ? (
                          <ActivityIndicator size="small" color="#0A45B5" />
                        ) : pincodeStatus && !pincodeStatus.isError ? (
                          <MaterialIcons name="check-circle" size={20} color="#10B981" />
                        ) : pincodeStatus && pincodeStatus.isError ? (
                          <MaterialIcons name="info-outline" size={20} color="#F59E0B" />
                        ) : (
                          <MaterialIcons name="pin-drop" size={20} color="#94A3B8" />
                        )}
                      </View>
                    </View>
                    <Text
                      style={[
                        postStyles.pincodeHelperText,
                        {
                          color: pincodeLoading
                            ? "#0A45B5"
                            : pincodeStatus
                            ? pincodeStatus.isError
                              ? "#D97706"
                              : "#059669"
                            : "#64748B",
                          fontWeight: pincodeStatus && !pincodeStatus.isError ? "600" : "400",
                        },
                      ]}
                    >
                      {pincodeLoading
                        ? "Checking Indian Postal Database..."
                        : pincodeStatus
                        ? pincodeStatus.message
                        : "Enter 6-digit Indian PIN code to auto-detect City and State."}
                    </Text>
                  </View>

                  {/* City / District */}
                  <View style={{ flex: 1, minWidth: 260, gap: 6 }}>
                    <Text style={postStyles.inputLabel}>
                      City / District <Text style={{ color: "#EF4444" }}>*</Text>
                    </Text>
                    <TextInput
                      style={postStyles.customInput}
                      placeholder="Auto-filled from Pincode"
                      placeholderTextColor="#94A3B8"
                      value={form.district}
                      onChangeText={set("district")}
                    />
                    <Text style={{ fontSize: 11, color: "#64748B" }}>
                      Populated automatically or editable manually
                    </Text>
                  </View>
                </View>

                <View style={postStyles.formRowTwoCol}>
                  {/* State */}
                  <View style={{ flex: 1, minWidth: 260, gap: 6 }}>
                    <Text style={postStyles.inputLabel}>
                      State <Text style={{ color: "#EF4444" }}>*</Text>
                    </Text>
                    <TextInput
                      style={postStyles.customInput}
                      placeholder="Auto-filled from Pincode"
                      placeholderTextColor="#94A3B8"
                      value={form.state}
                      onChangeText={set("state")}
                    />
                  </View>

                  {/* Locality / Block */}
                  <View style={{ flex: 1, minWidth: 260, gap: 6 }}>
                    <Text style={postStyles.inputLabel}>Locality / Area / Block</Text>
                    <TextInput
                      style={postStyles.customInput}
                      placeholder="e.g. Saguna More, Bailey Road"
                      placeholderTextColor="#94A3B8"
                      value={form.block}
                      onChangeText={set("block")}
                    />
                  </View>
                </View>

                {/* Coordinates & GPS fetch */}
                <View style={postStyles.gpsBox}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <View style={{ gap: 2 }}>
                      <Text style={{ fontWeight: "700", color: "#0B1B3F", fontSize: 15 }}>
                        GPS Location Coordinates
                      </Text>
                      <Text style={{ fontSize: 13, color: "#64748B" }}>
                        Required for assigned Verifier on-ground plot inspection.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={postStyles.useGpsBtn}
                      onPress={() =>
                        action.run(async () => {
                          const permission = await Location.requestForegroundPermissionsAsync();
                          if (permission.status !== "granted") {
                            throw new Error("Location permission denied. Enter coordinates manually.");
                          }
                          const location = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.High,
                          });
                          set("lat")(String(location.coords.latitude));
                          set("lng")(String(location.coords.longitude));
                        })
                      }
                      activeOpacity={0.8}
                    >
                      <MaterialIcons name="my-location" size={16} color="#0A45B5" />
                      <Text style={postStyles.useGpsBtnText}>Use Current Location</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={postStyles.formRowTwoCol}>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={postStyles.inputLabel}>Latitude *</Text>
                      <TextInput
                        style={postStyles.customInput}
                        value={form.lat}
                        onChangeText={set("lat")}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={postStyles.inputLabel}>Longitude *</Text>
                      <TextInput
                        style={postStyles.customInput}
                        value={form.lng}
                        onChangeText={set("lng")}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                </View>

                {/* Satellite Demarcation Map */}
                <View style={{ gap: 10, marginTop: 8 }}>
                  <Text style={postStyles.cardHeaderTitle}>Demarcate Property Boundary (Optional)</Text>
                  <Text style={postStyles.cardHeaderSubtitle}>
                    Draw the boundary outline on the satellite map. Tap points around the plot corners to mark the perimeter.
                  </Text>
                  <View style={postStyles.mapContainer}>
                    <MapParcelPicker
                      initialPoints={points}
                      onParcelChange={onParcelChange}
                      areaSqFt={form.totalArea || "2,400"}
                    />
                  </View>

                  <View style={postStyles.formRowTwoCol}>
                    <View style={{ flex: 2, gap: 6 }}>
                      <Text style={postStyles.inputLabel}>Boundary Description</Text>
                      <TextInput
                        style={postStyles.customInput}
                        placeholder="e.g. North: 30ft Road, South: Plot 42, East: Boundary wall, West: Green belt"
                        placeholderTextColor="#94A3B8"
                        value={form.boundary}
                        onChangeText={set("boundary")}
                      />
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={postStyles.inputLabel}>Road Width (ft)</Text>
                      <TextInput
                        style={postStyles.customInput}
                        placeholder="e.g. 30"
                        placeholderTextColor="#94A3B8"
                        value={form.roadWidth}
                        onChangeText={set("roadWidth")}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* STEP 3: Price, Area & Disclosures */}
            {step === 3 && (
              <View style={{ gap: 22 }}>
                <View style={{ gap: 4 }}>
                  <Text style={postStyles.cardHeaderTitle}>Expected Price & Plot Dimensions</Text>
                  <Text style={postStyles.cardHeaderSubtitle}>
                    Set fair pricing and area metrics. MalikSe charges 0% brokerage on your deal.
                  </Text>
                </View>

                {/* Price input with live badge */}
                <View style={{ gap: 8 }}>
                  <Text style={postStyles.inputLabel}>
                    Expected Price (₹) <Text style={{ color: "#EF4444" }}>*</Text>
                  </Text>
                  <View style={postStyles.priceInputWrapper}>
                    <Text style={postStyles.currencySymbol}>₹</Text>
                    <TextInput
                      style={postStyles.priceInput}
                      placeholder="e.g. 4500000"
                      placeholderTextColor="#94A3B8"
                      value={form.price}
                      onChangeText={set("price")}
                      keyboardType="numeric"
                    />
                  </View>
                  {Number(form.price) > 0 && (
                    <View style={postStyles.formattedPricePill}>
                      <MaterialIcons name="payments" size={16} color="#0A45B5" />
                      <Text style={postStyles.formattedPriceText}>
                        Asking Price: {money(Number(form.price))}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Area fields */}
                <View style={postStyles.formRowTwoCol}>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={postStyles.inputLabel}>
                      Total Area (sq ft) <Text style={{ color: "#EF4444" }}>*</Text>
                    </Text>
                    <TextInput
                      style={postStyles.customInput}
                      placeholder="e.g. 1800"
                      placeholderTextColor="#94A3B8"
                      value={form.totalArea}
                      onChangeText={(v: string) => {
                        setForm((f: any) => ({
                          ...f,
                          totalArea: v,
                          sellableArea: (!f.sellableArea || f.sellableArea === f.totalArea) ? v : f.sellableArea,
                        }));
                      }}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1, gap: 6 }}>
                    <Text style={postStyles.inputLabel}>Sellable Area (sq ft)</Text>
                    <TextInput
                      style={postStyles.customInput}
                      placeholder="e.g. 1800"
                      placeholderTextColor="#94A3B8"
                      value={form.sellableArea}
                      onChangeText={set("sellableArea")}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {katthaApprox && (
                  <View style={postStyles.katthaCalcBadge}>
                    <MaterialIcons name="square-foot" size={16} color="#059669" />
                    <Text style={postStyles.katthaCalcText}>
                      Area Estimate: {form.totalArea} sq ft ≈ {katthaApprox} Kattha (Bihar Standard: ~1,361 sq ft / Kattha)
                    </Text>
                  </View>
                )}

                {/* Checkbox Disclosures */}
                <View style={{ gap: 12, marginTop: 4 }}>
                  {[
                    ["negotiable", "Price is negotiable"],
                    ["hasLoan", "Property has an existing bank loan / lien"],
                    ["hasDispute", "Property has an ongoing legal dispute"],
                  ].map(([key, labelText]) => (
                    <TouchableOpacity
                      key={key}
                      style={postStyles.checkboxRow}
                      onPress={() => set(key)(!form[key])}
                      activeOpacity={0.8}
                    >
                      <MaterialIcons
                        name={form[key] ? "check-box" : "check-box-outline-blank"}
                        size={22}
                        color={form[key] ? "#0A45B5" : "#94A3B8"}
                      />
                      <Text style={postStyles.checkboxLabel}>{labelText}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Possession Status pills */}
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={postStyles.inputLabel}>Possession Status</Text>
                  <View style={postStyles.possessionChipsRow}>
                    {["Immediate", "Within 3 Months", "Under Construction", "With Owner"].map((pos) => {
                      const isSelected = form.possessionStatus === pos;
                      return (
                        <TouchableOpacity
                          key={pos}
                          style={[
                            postStyles.possessionChip,
                            isSelected && postStyles.possessionChipSelected,
                          ]}
                          onPress={() => set("possessionStatus")(pos)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              postStyles.possessionChipText,
                              isSelected && postStyles.possessionChipTextSelected,
                            ]}
                          >
                            {pos}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            )}

            {/* STEP 4: Photos & Documents */}
            {step === 4 && (
              <View style={{ gap: 22 }}>
                <View style={{ gap: 4 }}>
                  <Text style={postStyles.cardHeaderTitle}>Property Photos & Ownership Documents</Text>
                  <Text style={postStyles.cardHeaderSubtitle}>
                    Upload at least one high-resolution photo. Ownership deeds remain private and reviewed only by assigned staff.
                  </Text>
                </View>

                {/* Photo Action Buttons */}
                <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
                  <TouchableOpacity
                    style={postStyles.uploadBtn}
                    onPress={() => action.run(() => pick(false))}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="add-a-photo" size={18} color="#0A45B5" />
                    <Text style={postStyles.uploadBtnText}>Upload Property Photos</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={postStyles.demoSamplePhotoBtn}
                    onPress={addSamplePhoto}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="image" size={18} color="#059669" />
                    <Text style={postStyles.demoSamplePhotoBtnText}>Add Demo Sample Photo</Text>
                  </TouchableOpacity>
                </View>

                {/* Photos Thumbnail Grid */}
                <View style={postStyles.photoThumbnailGrid}>
                  {form.media?.photos?.map((uri: string, index: number) => (
                    <View key={uri + index} style={postStyles.thumbnailWrapper}>
                      <Image source={{ uri }} style={postStyles.thumbnailImg} />
                      <TouchableOpacity
                        onPress={() => removePhoto(index, false)}
                        style={postStyles.deleteBadge}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="close" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {photos.map((p, index) => (
                    <View key={p.uri + index} style={postStyles.thumbnailWrapper}>
                      <Image source={{ uri: p.uri }} style={postStyles.thumbnailImg} />
                      <TouchableOpacity
                        onPress={() => removePhoto(index, true)}
                        style={postStyles.deleteBadge}
                        activeOpacity={0.8}
                      >
                        <MaterialIcons name="close" size={13} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>

                {/* Ownership Documents section */}
                <View style={{ gap: 12, marginTop: 12, paddingTop: 18, borderTopWidth: 1, borderTopColor: "#E2E8F0" }}>
                  <View style={{ gap: 4 }}>
                    <Text style={postStyles.cardHeaderTitle}>Ownership Documents (Optional)</Text>
                    <Text style={postStyles.cardHeaderSubtitle}>
                      Attach Registry Deed, Mutation Receipt, or Khatiyan LPC to fast-track verification.
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[postStyles.uploadBtn, { alignSelf: "flex-start" }]}
                    onPress={() => action.run(() => pick(true))}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="upload-file" size={18} color="#0A45B5" />
                    <Text style={postStyles.uploadBtnText}>Add Ownership Documents (PDF, JPG)</Text>
                  </TouchableOpacity>

                  {documents.map((d, index) => (
                    <View key={d.uri + index} style={postStyles.docListItem}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                        <MaterialIcons name="description" size={20} color="#0A45B5" />
                        <Text style={postStyles.docFileName} numberOfLines={1}>
                          {d.name}
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => removeDocument(index)} activeOpacity={0.7}>
                        <MaterialIcons name="delete" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* STEP 5: Review, Advisor Assignment & Submit */}
            {step === 5 && (
              <View style={{ gap: 22 }}>
                <View style={{ gap: 4 }}>
                  <Text style={postStyles.cardHeaderTitle}>Review Details & Final Submission</Text>
                  <Text style={postStyles.cardHeaderSubtitle}>
                    Review your property parameters before submitting for verification and team assignment.
                  </Text>
                </View>

                {/* Comprehensive Summary Preview Card */}
                <View style={postStyles.reviewSummaryCard}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                    <View style={postStyles.categoryReviewPill}>
                      <Text style={postStyles.categoryReviewPillText}>
                        {form.type?.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={postStyles.reviewPriceText}>{money(Number(form.price))}</Text>
                  </View>

                  <Text style={postStyles.reviewTitleText}>
                    {form.title || `${form.type} in ${form.district}`}
                  </Text>

                  <View style={postStyles.reviewLocationRow}>
                    <MaterialIcons name="place" size={16} color="#0A45B5" />
                    <Text style={postStyles.reviewLocationText}>
                      {form.block ? `${form.block}, ` : ""}{form.district}, {form.state} {form.pincode}
                    </Text>
                  </View>

                  <View style={postStyles.reviewSpecsGrid}>
                    <View style={postStyles.reviewSpecItem}>
                      <Text style={postStyles.reviewSpecLabel}>Total Area</Text>
                      <Text style={postStyles.reviewSpecValue}>{form.totalArea} sq ft</Text>
                    </View>
                    <View style={postStyles.reviewSpecItem}>
                      <Text style={postStyles.reviewSpecLabel}>Sellable Area</Text>
                      <Text style={postStyles.reviewSpecValue}>{form.sellableArea || form.totalArea} sq ft</Text>
                    </View>
                    {katthaApprox && (
                      <View style={postStyles.reviewSpecItem}>
                        <Text style={postStyles.reviewSpecLabel}>Bihar Kattha</Text>
                        <Text style={postStyles.reviewSpecValue}>~{katthaApprox} Kattha</Text>
                      </View>
                    )}
                    <View style={postStyles.reviewSpecItem}>
                      <Text style={postStyles.reviewSpecLabel}>Possession</Text>
                      <Text style={postStyles.reviewSpecValue}>{form.possessionStatus}</Text>
                    </View>
                  </View>

                  {points.length >= 3 && (
                    <View style={postStyles.demarcationDoneBadge}>
                      <MaterialIcons name="check-circle" size={15} color="#059669" />
                      <Text style={postStyles.demarcationDoneText}>
                        Boundary Demarcated: {points.length} GPS Cadastral Points
                      </Text>
                    </View>
                  )}

                  <Text style={postStyles.photoCountText}>
                    📷 {photos.length + (form.media?.photos?.length || 0)} Property Photo(s) Attached
                  </Text>
                </View>

                {/* Advisor ID */}
                <View style={{ gap: 6 }}>
                  <Text style={postStyles.inputLabel}>Advisor ID (Optional)</Text>
                  <TextInput
                    style={postStyles.customInput}
                    placeholder="Leave blank to automatically assign the next available staff"
                    placeholderTextColor="#94A3B8"
                    value={form.requestedAdvisorId}
                    onChangeText={set("requestedAdvisorId")}
                  />
                  <Text style={postStyles.inputHelperText}>
                    If an Advisor helped you prepare this listing, enter their ID here. Otherwise an eligible staff member will be assigned automatically.
                  </Text>
                </View>

                {/* Identity Verification Status */}
                <View
                  style={[
                    postStyles.idVerifyBox,
                    approved(user) ? postStyles.idVerifyBoxApproved : postStyles.idVerifyBoxPending,
                  ]}
                >
                  <MaterialIcons
                    name={approved(user) ? "verified" : "info"}
                    size={26}
                    color={approved(user) ? "#059669" : "#0A45B5"}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={[
                        postStyles.idVerifyTitle,
                        approved(user) ? { color: "#065F46" } : { color: "#1E40AF" },
                      ]}
                    >
                      {approved(user)
                        ? "Identity Verified Seller"
                        : "Demo Mode: Verification Auto-Completes on Submit"}
                    </Text>
                    <Text
                      style={[
                        postStyles.idVerifyDesc,
                        approved(user) ? { color: "#047857" } : { color: "#3B82F6" },
                      ]}
                    >
                      {approved(user)
                        ? "Your account has full verified seller privileges."
                        : "You can click Submit directly, or click Verify Now beforehand."}
                    </Text>
                  </View>
                  {!approved(user) && (
                    <TouchableOpacity
                      onPress={() =>
                        action.run(async () => {
                          await authService.completeDemoKyc();
                        })
                      }
                      style={postStyles.verifyNowPill}
                      activeOpacity={0.8}
                    >
                      <Text style={postStyles.verifyNowPillText}>Verify Now</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Consent Checkbox */}
                <TouchableOpacity
                  style={postStyles.checkboxRow}
                  onPress={() => setConsent(!consent)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons
                    name={consent ? "check-box" : "check-box-outline-blank"}
                    size={24}
                    color={consent ? "#0A45B5" : "#94A3B8"}
                  />
                  <Text style={[postStyles.checkboxLabel, { flex: 1, lineHeight: 20 }]}>
                    I confirm that I am authorized to list this property and that all details, coordinates, and disclosures provided are accurate and truthful.
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Integrated Card Action Footer */}
            <View style={postStyles.cardActionFooter}>
              <TouchableOpacity
                style={postStyles.footerBackBtn}
                onPress={handleBack}
                activeOpacity={0.8}
              >
                <MaterialIcons name="arrow-back" size={16} color="#0A45B5" />
                <Text style={postStyles.footerBackBtnText}>
                  {step > 1 ? "Previous Step" : "Cancel & Return to Home"}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                <Text style={postStyles.stepIndicatorBadge}>Step {step} of 5</Text>
                <TouchableOpacity
                  style={[
                    postStyles.footerContinueBtn,
                    (action.busy || (step === 5 && !consent)) && postStyles.footerContinueBtnDisabled,
                  ]}
                  onPress={() => (step === 5 ? submit() : goToNextStep())}
                  activeOpacity={0.85}
                  disabled={action.busy || (step === 5 && !consent)}
                >
                  <Text style={postStyles.footerContinueBtnText}>
                    {action.busy
                      ? "Submitting Listing..."
                      : step === 5
                        ? "Submit for Verification →"
                        : step === 1
                          ? "Continue to Location →"
                          : step === 2
                            ? "Continue to Pricing →"
                            : step === 3
                              ? "Continue to Photos →"
                              : "Review Listing →"}
                  </Text>
                  {!action.busy && (
                    <MaterialIcons name="arrow-forward" size={17} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Bottom Trust Assurance Ribbon matching website design */}
          <View style={postStyles.trustAssuranceRow}>
            <View style={postStyles.trustAssuranceTile}>
              <View style={[postStyles.trustTileIconBox, { backgroundColor: "#EFF6FF" }]}>
                <MaterialIcons name="gavel" size={20} color="#0A45B5" />
              </View>
              <View style={{ gap: 2, flex: 1 }}>
                <Text style={postStyles.trustTileTitle}>Revenue Record Verification</Text>
                <Text style={postStyles.trustTileDesc}>
                  Jamabandi, Khatiyan & Circle Office LPC audit
                </Text>
              </View>
            </View>

            <View style={postStyles.trustAssuranceTile}>
              <View style={[postStyles.trustTileIconBox, { backgroundColor: "#ECFDF5" }]}>
                <MaterialIcons name="place" size={20} color="#059669" />
              </View>
              <View style={{ gap: 2, flex: 1 }}>
                <Text style={postStyles.trustTileTitle}>Physical GPS Demarcation</Text>
                <Text style={postStyles.trustTileDesc}>
                  Surveyor coordinates with boundary corner pegs
                </Text>
              </View>
            </View>

            <View style={postStyles.trustAssuranceTile}>
              <View style={[postStyles.trustTileIconBox, { backgroundColor: "#FEF3C7" }]}>
                <MaterialIcons name="support-agent" size={20} color="#D97706" />
              </View>
              <View style={{ gap: 2, flex: 1 }}>
                <Text style={postStyles.trustTileTitle}>Assigned Property Team</Text>
                <Text style={postStyles.trustTileDesc}>
                  Dedicated Advisor and Verifier to assist offers & closure
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </MarketplaceShell>
  );
}

const postStyles = StyleSheet.create({
  pageContainer: {
    width: "100%",
    maxWidth: 1040,
    alignSelf: "center",
    gap: 20,
    paddingVertical: 10,
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
  },
  backButtonPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  backButtonPillText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0A45B5",
  },
  verifiedBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  verifiedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A45B5",
    letterSpacing: 0.2,
  },
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#475A82",
    lineHeight: 22,
  },
  zeroBrokerageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  zeroBrokerageText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepCircleActive: {
    backgroundColor: "#0A45B5",
    borderColor: "#0A45B5",
  },
  stepCircleCompleted: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  stepCircleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  stepCircleTextActive: {
    color: "#FFFFFF",
  },
  stepTextCol: {
    gap: 1,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  stepLabelActive: {
    fontWeight: "800",
    color: "#0B1B3F",
  },
  stepLabelCompleted: {
    fontWeight: "700",
    color: "#059669",
  },
  stepSubLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },
  stepConnectorLine: {
    flex: 1,
    height: 2,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 12,
  },
  stepConnectorLineCompleted: {
    backgroundColor: "#059669",
  },
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 30,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
    gap: 20,
  },
  cardHeaderTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.3,
  },
  cardHeaderSubtitle: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  categoryCard: {
    flex: 1,
    minWidth: 160,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 10,
    position: "relative",
    minHeight: 136,
  },
  categoryCardSelected: {
    borderColor: "#0A45B5",
    backgroundColor: "#F4F8FF",
    borderWidth: 2,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  categoryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  categoryIconBoxSelected: {
    backgroundColor: "#0A45B5",
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryTextWrapper: {
    alignItems: "center",
    gap: 3,
    width: "100%",
  },
  categoryCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0B1B3F",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  categoryCardTitleSelected: {
    color: "#0A45B5",
    fontWeight: "800",
  },
  categoryCardSub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 16,
  },
  categoryCardSubSelected: {
    color: "#2563EB",
    fontWeight: "500",
  },
  categoryCheckBadge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#0A45B5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B1B3F",
  },
  customInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: "#0B1B3F",
  },
  inputHelperText: {
    fontSize: 12,
    color: "#64748B",
  },
  pincodeInputWrapper: {
    position: "relative",
    justifyContent: "center",
  },
  pincodeInput: {
    paddingRight: 42,
  },
  pincodeIconBadge: {
    position: "absolute",
    right: 12,
    top: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  pincodeHelperText: {
    fontSize: 12,
    lineHeight: 16,
  },
  formRowTwoCol: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  gpsBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  useGpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  useGpsBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A45B5",
  },
  mapContainer: {
    minHeight: Platform.OS === "web" ? 440 : 380,
    borderRadius: 18,
    marginVertical: 4,
  },
  priceInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0A45B5",
    marginRight: 6,
  },
  priceInput: {
    flex: 1,
    minHeight: 48,
    fontSize: 16,
    fontWeight: "700",
    color: "#0B1B3F",
  },
  formattedPricePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
  },
  formattedPriceText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A45B5",
  },
  katthaCalcBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  katthaCalcText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkboxLabel: {
    fontSize: 14,
    color: "#0B1B3F",
    fontWeight: "500",
  },
  possessionChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  possessionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  possessionChipSelected: {
    backgroundColor: "#0A45B5",
    borderColor: "#0A45B5",
  },
  possessionChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475A82",
  },
  possessionChipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A45B5",
  },
  demoSamplePhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1.5,
    borderColor: "#A7F3D0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  demoSamplePhotoBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  photoThumbnailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  thumbnailWrapper: {
    position: "relative",
    width: 130,
    height: 95,
  },
  thumbnailImg: {
    width: 130,
    height: 95,
    borderRadius: 14,
    backgroundColor: "#E2E8F0",
  },
  deleteBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  docListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    borderRadius: 10,
  },
  docFileName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0B1B3F",
  },
  reviewSummaryCard: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 20,
    gap: 12,
  },
  categoryReviewPill: {
    backgroundColor: "#0A45B5",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryReviewPillText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  reviewPriceText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1B3F",
  },
  reviewTitleText: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0B1B3F",
  },
  reviewLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  reviewLocationText: {
    fontSize: 13,
    color: "#475A82",
    fontWeight: "600",
  },
  reviewSpecsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  reviewSpecItem: {
    flex: 1,
    minWidth: 120,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 2,
  },
  reviewSpecLabel: {
    fontSize: 11,
    color: "#64748B",
    textTransform: "uppercase",
    fontWeight: "600",
  },
  reviewSpecValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B1B3F",
  },
  demarcationDoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ECFDF5",
    padding: 8,
    borderRadius: 8,
  },
  demarcationDoneText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  photoCountText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  idVerifyBox: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  idVerifyBoxApproved: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  idVerifyBoxPending: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  idVerifyTitle: {
    fontWeight: "700",
    fontSize: 14,
  },
  idVerifyDesc: {
    fontSize: 12,
  },
  verifyNowPill: {
    backgroundColor: "#0A45B5",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  verifyNowPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  cardActionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 20,
    borderTopWidth: 1.5,
    borderTopColor: "#EDF2F7",
    marginTop: 8,
  },
  footerBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
  },
  footerBackBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A45B5",
  },
  stepIndicatorBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
  },
  footerContinueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A45B5",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 3,
  },
  footerContinueBtnDisabled: {
    opacity: 0.5,
  },
  footerContinueBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  primaryBtnLg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A45B5",
    paddingHorizontal: 22,
    paddingVertical: 13,
    borderRadius: 14,
  },
  primaryBtnLgText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryBtnLg: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#DBEAFE",
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 14,
  },
  secondaryBtnLgText: {
    color: "#0A45B5",
    fontSize: 14,
    fontWeight: "700",
  },
  trustMiniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EBF2FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  trustMiniBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0A45B5",
  },
  trustAssuranceRow: {
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
    marginTop: 10,
  },
  trustAssuranceTile: {
    flex: 1,
    minWidth: 260,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  trustTileIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trustTileTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0B1B3F",
  },
  trustTileDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
});
const font =
  Platform.OS === "web" ? "Manrope, Inter, system-ui" : "PoppinsRegular";

const profileStyles = StyleSheet.create({
  profileHeaderCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 24,
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    gap: 20,
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 20,
  },
  profileUserGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    flexWrap: "wrap",
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: "#0A45B5",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
    fontFamily: font,
  },
  profileInfo: {
    gap: 6,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.4,
    fontFamily: font,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contactText: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
    fontFamily: font,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
    flexWrap: "wrap",
  },
  approvedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
  },
  approvedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
    fontFamily: font,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
  },
  pendingBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#D97706",
    fontFamily: font,
  },
  roleBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#DBEAFE",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0A45B5",
    fontFamily: font,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  statTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  statTileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statTileVal: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B1B3F",
    fontFamily: font,
  },
  statTileLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
    fontFamily: font,
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderWidth: 1.5,
    borderColor: "#0A45B5",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A45B5",
    fontFamily: font,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0B1B3F",
    letterSpacing: -0.3,
    marginTop: 10,
    marginBottom: 4,
    fontFamily: font,
  },
  optionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  optionCardActive: {
    borderColor: "#0A45B5",
    backgroundColor: "#FAFCFF",
  },
  optionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B1B3F",
    fontFamily: font,
  },
  optionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontFamily: font,
  },
  countPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0A45B5",
    fontFamily: font,
  },
  expandableBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#0A45B5",
    padding: 20,
    gap: 16,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  expandableHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 12,
  },
  expandableTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0B1B3F",
    fontFamily: font,
  },
  formInputWrap: {
    gap: 6,
  },
  formInputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0B1B3F",
    fontFamily: font,
  },
  formTextInput: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    fontSize: 14,
    color: "#0B1B3F",
    fontFamily: font,
  },
  formActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    flexWrap: "wrap",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A45B5",
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: font,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 12,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748B",
    fontFamily: font,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: 12,
    borderRadius: 12,
  },
  successBannerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
    fontFamily: font,
  },
  listingCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    padding: 14,
    flexWrap: "wrap",
  },
  listingThumbnail: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  postNewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0A45B5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  postNewBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: font,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FFF1F2",
    borderWidth: 1.5,
    borderColor: "#FECDD3",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#E11D48",
    fontFamily: font,
  },
});
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  headerWrapper: {
    width: "100%",
    paddingTop: 14,
    paddingHorizontal: 20,
    paddingBottom: 4,
    backgroundColor: "transparent",
    zIndex: 100,
  },
  header: {
    width: "100%",
    maxWidth: 1240,
    alignSelf: "center",
    minHeight: 66,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "white",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    boxShadow: "0 4px 20px rgba(11, 27, 63, 0.05)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
    borderRadius: 8,
  },
  brandLockup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandTextCol: {
    justifyContent: "center",
  },
  logo: {
    fontFamily: font,
    fontSize: 22,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.5,
    lineHeight: 25,
  },
  brandTagline: {
    fontFamily: font,
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748b",
    letterSpacing: 0.1,
    lineHeight: 14,
  },
  logoIcon: {
    backgroundColor: C.blue,
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(10, 69, 181, 0.22)",
  },
  topNavRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  topNavItem: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  topNavItemActive: {
    backgroundColor: "white",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  topNavText: {
    fontFamily: font,
    fontSize: 13.5,
    fontWeight: "600",
    color: "#64748b",
  },
  topNavTextActive: {
    color: C.blue,
    fontWeight: "700",
  },
  topPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.blue,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    boxShadow: "0 2px 8px rgba(10, 69, 181, 0.22)",
  },
  topPostBtnText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "700",
    color: "white",
  },
  topProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "white",
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarSmallText: {
    fontWeight: "800",
    color: "white",
    fontSize: 13,
  },
  topProfileName: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  heroContainer: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 24,
    padding: 34,
    gap: 20,
    boxShadow: "0 4px 20px rgba(11,27,63,0.04)",
  },
  heroBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  heroBadgeText: {
    fontFamily: font,
    fontSize: 11,
    fontWeight: "700",
    color: C.blue,
    letterSpacing: 0.5,
  },
  heroHeading: {
    fontFamily: font,
    fontSize: 32,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.6,
  },
  heroSubheading: {
    fontFamily: font,
    fontSize: 15,
    lineHeight: 23,
    color: "#64748b",
  },
  searchConsole: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 22,
    padding: 7,
    shadowColor: "#0B1B3F",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: "0 10px 30px -4px rgba(11, 27, 63, 0.08), 0 2px 8px rgba(11, 27, 63, 0.03)",
      },
    }),
  },
  searchSegmentLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 190,
    backgroundColor: "transparent",
  },
  searchSegmentFocused: {
    backgroundColor: "#F8FAFC",
  },
  searchSegmentIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  searchSegmentLabel: {
    fontFamily: font,
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.7,
    marginBottom: 2,
  },
  searchSegmentValue: {
    fontFamily: font,
    fontSize: 13.5,
    fontWeight: "700",
    color: C.ink,
  },
  searchDivider: {
    width: 1.5,
    height: 36,
    backgroundColor: "#E2E8F0",
    marginHorizontal: 4,
  },
  searchSegmentInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  searchTextInput: {
    fontFamily: font,
    fontSize: 14.5,
    fontWeight: "600",
    color: "#0B1B3F",
    padding: 0,
    margin: 0,
    height: 24,
    borderWidth: 0,
    outlineWidth: 0 as any,
    outlineStyle: "none" as any,
    outlineColor: "transparent" as any,
    backgroundColor: "transparent",
  },
  searchClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  searchSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0A45B5",
    paddingVertical: 13,
    paddingHorizontal: 26,
    borderRadius: 16,
    shadowColor: "#0A45B5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
    ...Platform.select({
      web: {
        boxShadow: "0 4px 14px rgba(10, 69, 181, 0.28)",
      },
    }),
  },
  searchSubmitBtnText: {
    fontFamily: font,
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  categoryPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  categoryPillActive: {
    backgroundColor: C.blue,
    borderColor: C.blue,
  },
  categoryPillText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  categoryPillTextActive: {
    color: "white",
    fontWeight: "700",
  },
  heroTrustStrip: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  trustItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trustItemText: {
    fontFamily: font,
    fontSize: 12.5,
    fontWeight: "500",
    color: "#64748b",
  },
  trustDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
  },
  scroll: { padding: 20, paddingBottom: 40 },
  content: { width: "100%", maxWidth: 1240, alignSelf: "center", gap: 26 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 18 },
  h1: {
    fontFamily: font,
    fontSize: 28,
    fontWeight: "800",
    color: C.ink,
    letterSpacing: -0.6,
  },
  h2: { fontFamily: font, fontSize: 21, fontWeight: "700", color: C.ink },
  muted: { fontFamily: font, fontSize: 14, lineHeight: 22, color: C.muted },
  small: { fontFamily: font, fontSize: 12, lineHeight: 19, color: C.muted },
  body: { fontFamily: font, fontSize: 15, lineHeight: 24, color: C.ink },
  fieldLabel: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "700",
    color: C.ink,
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: C.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondary: {
    backgroundColor: "#eaf1ff",
    borderWidth: 1,
    borderColor: C.line,
  },
  buttonText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "700",
    color: "white",
  },
  input: {
    fontFamily: font,
    minHeight: 48,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "white",
    fontSize: 15,
    color: C.ink,
  },
  hero: {
    padding: 28,
    gap: 18,
    borderRadius: 24,
    backgroundColor: "#e5efff",
    borderWidth: 1,
    borderColor: "#d0e0ff",
  },
  heroTitle: {
    fontFamily: Platform.OS === "web" ? "Fraunces, Georgia" : "PoppinsBold",
    fontSize: 40,
    color: C.ink,
    letterSpacing: -1,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#eaf1ff",
  },
  tagText: { fontFamily: font, fontSize: 11, fontWeight: "700", color: C.blue },
  typeChip: {
    padding: 14,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    backgroundColor: "white",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  panel: {
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: "white",
    gap: 16,
  },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 20,
    overflow: "hidden",
  },
  photo: { height: 220, backgroundColor: "#dce7fa" },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0eaff",
  },
  imageTags: { position: "absolute", top: 12, left: 12 },
  cardBody: { padding: 18, gap: 9 },
  price: { fontFamily: font, fontSize: 25, fontWeight: "800", color: C.ink },
  cardTitle: {
    fontFamily: font,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
    color: C.ink,
  },
  link: { fontSize: 13, fontWeight: "700", color: C.blue },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e2ecff",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: C.blue, fontSize: 17 },
  nav: {
    minHeight: 76,
    paddingBottom: Platform.OS === "web" ? 10 : 22,
    paddingTop: 9,
    flexDirection: "row",
    backgroundColor: "white",
    borderTopWidth: 1,
    borderColor: C.line,
    justifyContent: "center",
  },
  navItem: {
    flex: 1,
    maxWidth: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navText: { fontSize: 11, color: C.muted },
  postCircle: {
    height: 50,
    width: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.blue,
    borderWidth: 4,
    borderColor: C.bg,
  },
  error: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff0f2",
    color: "#a8193c",
    fontSize: 14,
  },
  map: {
    height: 420,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: C.line,
  },
  spec: {
    minWidth: 140,
    flex: 1,
    padding: 16,
    backgroundColor: C.bg,
    borderRadius: 14,
    gap: 6,
  },
  chatArea: { gap: 16, minHeight: 260 },
  bubble: { maxWidth: "85%", padding: 16, borderRadius: 18, gap: 7 },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "#dce9ff",
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: C.line,
    borderBottomLeftRadius: 4,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue },
  history: { padding: 12, borderLeftWidth: 3, borderColor: C.line, gap: 4 },
  progress: { flexDirection: "row", gap: 6 },
  progressPart: {
    height: 5,
    flex: 1,
    borderRadius: 5,
    backgroundColor: C.line,
  },
});
