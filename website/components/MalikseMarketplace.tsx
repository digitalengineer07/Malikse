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
    [type, setType] = useState(""),
    [prefs, setPrefs] = useState<any>({});
  useEffect(() => {
    AsyncStorage.getItem(`marketplace_preferences_${user?.id || "guest"}`)
      .then((v) => setPrefs(v ? JSON.parse(v) : {}))
      .catch(() => {});
  }, [user?.id]);
  const personal = useData(
      `/recommendations?mode=personalized&district=${encodeURIComponent(prefs.district || "")}&type=${type || prefs.type || ""}&maxPrice=${prefs.maxPrice || ""}`,
      [user?.id],
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
        <View style={[s.searchConsole, width < 768 && { flexDirection: "column", alignItems: "stretch", padding: 10 }]}>
          <View style={s.searchSegmentLocation}>
            <View style={s.searchSegmentIconWrap}>
              <Icon name="location-on" size={18} color={C.blue} />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={s.searchSegmentLabel}>LOCATION</Text>
              <Text style={s.searchSegmentValue} numberOfLines={1}>
                {prefs.district ? `${prefs.district}, Bihar` : "Explore All Bihar"}
              </Text>
            </View>
          </View>

          {width >= 768 ? (
            <View style={s.searchDivider} />
          ) : (
            <View style={{ height: 1, backgroundColor: "#e2e8f0", marginVertical: 6 }} />
          )}

          <View style={[s.searchSegmentInput, width < 768 && { paddingHorizontal: 4 }]}>
            <View style={s.searchSegmentIconWrap}>
              <Icon name="search" size={18} color="#94a3b8" />
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={s.searchSegmentLabel}>SEARCH PROPERTY</Text>
              <TextInput
                accessibilityLabel="Search location"
                placeholder="City, locality, road corridor or ID..."
                placeholderTextColor="#94a3b8"
                value={query}
                onChangeText={setQuery}
                style={s.searchTextInput}
                onSubmitEditing={() =>
                  router.push({
                    pathname: "/search",
                    params: { q: query, type },
                  } as any)
                }
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search"
            onPress={() =>
              router.push({
                pathname: "/search",
                params: { q: query, type },
              } as any)
            }
            style={[s.searchSubmitBtn, width < 768 && { marginTop: 8, justifyContent: "center" }]}
          >
            <Icon name="search" size={18} color="white" />
            <Text style={s.searchSubmitBtnText}>Search</Text>
          </Pressable>
        </View>

        {/* Category Filter Pills */}
        <View style={s.categoryPillsRow}>
          {types.map(([id, text, icon]) => {
            const isSelected = type === id;
            return (
              <Pressable
                key={id}
                onPress={() => setType(id)}
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
    [query, setQuery] = useState(String(params.q || "")),
    [type, setType] = useState(String(params.type || "")),
    [max, setMax] = useState(""),
    [filter, setFilter] = useState(false),
    [map, setMap] = useState(true),
    [selected, setSelected] = useState<any>(null),
    [submitted, setSubmitted] = useState(String(params.q || ""));
  const feed = useData(
    `/properties/search?limit=50&location=${encodeURIComponent(submitted)}${type ? "&type=" + type : ""}${max ? "&maxPrice=" + max : ""}`,
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
          district: query,
          type,
          ...(max ? { maxPrice: Number(max) } : {}),
        })
        .catch(() => {});
    void AsyncStorage.setItem(
      `marketplace_preferences_${user?.id || "guest"}`,
      JSON.stringify({ district: query, type, maxPrice: max }),
    );
  };
  return (
    <MarketplaceShell
      title="Explore properties"
      subtitle="Find your place on the map. Every listing is verified."
    >
      <View style={s.wrap}>
        <View style={[s.input, s.row, { flex: 1, minWidth: 180 }]}>
          <Icon name="search" />
          <TextInput
            accessibilityLabel="Search properties"
            value={query}
            onChangeText={setQuery}
            placeholder="City, district or property"
            onSubmitEditing={search}
            style={{ flex: 1 }}
          />
        </View>
        <Button title="Search" onPress={search} />
        <Button
          title="Filters"
          secondary
          icon="tune"
          onPress={() => setFilter(!filter)}
        />
      </View>
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
                onPress={() => setType(id)}
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
    [editing, setEditing] = useState(false),
    [name, setName] = useState(user?.name || ""),
    [email, setEmail] = useState(user?.email || "");
  return (
    <MarketplaceShell title="Your account">
      <Protected>
        {user && (
          <>
            <View style={[s.panel, { alignItems: "center", padding: 30 }]}>
              <View
                style={[s.avatar, { width: 76, height: 76, borderRadius: 38 }]}
              >
                <Text style={[s.avatarText, { fontSize: 30 }]}>
                  {user.name[0]}
                </Text>
              </View>
              <Text style={s.h2}>{user.name}</Text>
              <Text style={s.muted}>{user.mobile || user.email}</Text>
              <Tag green={approved(user)}>
                {approved(user)
                  ? "✓ Identity approved"
                  : "Identity verification pending"}
              </Tag>
            </View>
            <Text style={s.h2}>Account & preferences</Text>
            {[
              [
                "Personal information",
                "manage-accounts",
                "Update your name and email",
                "edit",
              ],
              [
                "My posted properties",
                "real-estate-agent",
                "Manage listings and verification",
                "/my-properties",
              ],
              [
                "Wishlist",
                "favorite-border",
                "Your saved properties",
                "/saved",
              ],
              [
                "Identity verification",
                "verified-user",
                "Submit and track KYC",
                "/kyc",
              ],
              [
                "Conversations",
                "chat-bubble-outline",
                "Chat with assigned staff",
                "/messages",
              ],
              ...(user.role !== "user"
                ? [
                    [
                      "Staff dashboard",
                      "dashboard",
                      "Assigned work and reviews",
                      dashboardRoutes[user.role],
                    ],
                  ]
                : []),
            ].map(([title, icon, sub, url]) => (
              <Pressable
                key={title}
                style={[s.panel, s.row]}
                onPress={() =>
                  url === "edit"
                    ? setEditing(!editing)
                    : router.push(url as any)
                }
              >
                <Icon name={icon} />
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{title}</Text>
                  <Text style={s.small}>{sub}</Text>
                </View>
                <Icon name="chevron-right" />
              </Pressable>
            ))}
            {editing && (
              <View style={s.panel}>
                <Field title="Full name" value={name} onChangeText={setName} />
                <Field title="Email" value={email} onChangeText={setEmail} />
                <Button
                  title="Save profile"
                  disabled={action.busy}
                  onPress={() =>
                    action.run(async () => {
                      await userService.updateProfile({ name, email });
                      await authService.getMe();
                      setEditing(false);
                    })
                  }
                />
              </View>
            )}
            <ErrorBox text={action.error} />
            <Button
              title="Log out of MalikSe"
              secondary
              icon="logout"
              onPress={() =>
                action.run(async () => {
                  await authService.logout();
                  router.replace("/home");
                })
              }
            />
          </>
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
  state: "Bihar",
  district: "Patna",
  block: "Danapur",
  pincode: "801503",
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

export function PostScreen() {
  const router = useRouter(),
    params = useLocalSearchParams(),
    user = useAuthStore((x) => x.user),
    [draftId, setDraftId] = useState(String(params.id || "")),
    [step, setStep] = useState(1),
    [done, setDone] = useState(false),
    [consent, setConsent] = useState(false),
    [points, setPoints] = useState<LatLngPoint[]>([]),
    [photos, setPhotos] = useState<DocumentPicker.DocumentPickerAsset[]>([]),
    [documents, setDocuments] = useState<DocumentPicker.DocumentPickerAsset[]>([]),
    [form, setForm] = useState<any>(defaultPostForm),
    action = useAction();

  const set = (key: string) => (value: any) =>
    setForm((f: any) => ({ ...f, [key]: value }));

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
          throw new Error("Please enter or choose a district in Bihar.");
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
        throw new Error("Please select or enter a district in Bihar.");
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

  return (
    <MarketplaceShell
      title="Post Property"
      subtitle={
        done
          ? "Your listing has been submitted"
          : `Step ${step} of 5 · Private until verified`
      }
      back
    >
      {!user ? (
        <View style={s.panel}>
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 16 }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: "#EBF2FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="add-business" size={34} color={C.blue} />
            </View>
            <Text style={[s.h1, { textAlign: "center", fontSize: 26, color: C.ink }]}>
              List Your Property on MalikSe
            </Text>
            <Text
              style={[
                s.body,
                { textAlign: "center", color: C.muted, maxWidth: 540, lineHeight: 22 },
              ]}
            >
              Connect directly with verified buyers across Bihar. Enjoy 0% brokerage, legal deed audit, and on-ground GPS boundary demarcation with your assigned property team.
            </Text>

            <View style={{ flexDirection: "row", gap: 16, marginVertical: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EBF2FF", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Icon name="verified" size={16} color={C.blue} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.blue }}>Verified Title Checks</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#ECFDF5", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Icon name="check-circle" size={16} color={C.green} />
                <Text style={{ fontSize: 13, fontWeight: "700", color: C.green }}>0% Brokerage</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#FEF3C7", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Icon name="place" size={16} color="#B45309" />
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#B45309" }}>GPS Demarcated</Text>
              </View>
            </View>

            <View
              style={{
                flexDirection: "row",
                gap: 14,
                flexWrap: "wrap",
                justifyContent: "center",
                marginTop: 12,
              }}
            >
              <Button
                title="Sign In to Post Property"
                icon="login"
                onPress={() =>
                  router.push({
                    pathname: "/login",
                    params: { returnTo: "/post" },
                  } as any)
                }
              />
              <Button
                title="Create Free Account"
                secondary
                icon="person-add"
                onPress={() =>
                  router.push({
                    pathname: "/register",
                    params: { returnTo: "/post" },
                  } as any)
                }
              />
            </View>
          </View>
        </View>
      ) : user.role !== "user" ? (
        <View style={s.panel}>
          <Text style={s.h2}>Staff Account Notice</Text>
          <Text style={s.muted}>
            Property posting is available for User accounts (buyers & sellers). You are currently logged in with a staff account ({user.role}).
          </Text>
          <Button
            title="Go to Staff Dashboard"
            onPress={() =>
              router.push((dashboardRoutes[user.role] || "/dashboard") as any)
            }
          />
        </View>
      ) : done ? (
        <View style={s.panel}>
          <View style={{ alignItems: "center", paddingVertical: 24, gap: 14 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: "#DCFCE7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="check" size={36} color="#15803D" />
            </View>
            <Text style={[s.h1, { fontSize: 24, textAlign: "center" }]}>
              Property Submitted Successfully!
            </Text>
            <Text style={[s.muted, { textAlign: "center", maxWidth: 500, lineHeight: 22 }]}>
              Your listing has been submitted for verification. An assigned Advisor or Verifier will review legal details and coordinate on-ground demarcation.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", justifyContent: "center", marginTop: 12 }}>
              <Button
                title="View My Listings"
                icon="list-alt"
                onPress={() => router.replace("/my-properties")}
              />
              <Button
                title="Post Another Property"
                secondary
                icon="add"
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
              />
            </View>
          </View>
        </View>
      ) : (
        <>
          <View style={s.progress}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  s.progressPart,
                  i <= step && { backgroundColor: C.blue },
                ]}
              />
            ))}
          </View>
          <ErrorBox text={action.error} />

          {step === 1 && (
            <View style={s.panel}>
              <Text style={s.h2}>What kind of property are you listing?</Text>
              <View style={s.wrap}>
                {types
                  .filter(([id]) => id)
                  .map(([id, title, icon]) => (
                    <Button
                      key={id}
                      title={title}
                      icon={icon}
                      secondary={form.type !== id}
                      onPress={() => set("type")(id)}
                    />
                  ))}
              </View>
              <Field
                title="Property title *"
                placeholder="e.g. 2,400 sq ft Commercial Plot near Bailey Road"
                value={form.title}
                onChangeText={set("title")}
              />
              <Field
                title="Description"
                placeholder="Provide details about access, boundary, surroundings, road width and documents..."
                value={form.description}
                onChangeText={set("description")}
                multiline
              />
            </View>
          )}

          {step === 2 && (
            <View style={s.panel}>
              <Text style={s.h2}>Where is the property located?</Text>
              
              <Text style={[s.fieldLabel, { marginTop: 4 }]}>Quick Select Popular Bihar Districts</Text>
              <View style={[s.wrap, { marginVertical: 4 }]}>
                {BIHAR_DISTRICTS.map((d) => (
                  <TouchableOpacity
                    key={d.name}
                    onPress={() => {
                      setForm((f: any) => ({
                        ...f,
                        district: d.name,
                        lat: d.lat,
                        lng: d.lng,
                        pincode: f.pincode || d.pincode,
                      }));
                    }}
                    style={[
                      s.tag,
                      form.district?.toLowerCase() === d.name.toLowerCase()
                        ? { backgroundColor: C.blue }
                        : { backgroundColor: "#EBF2FF" },
                    ]}
                  >
                    <Text
                      style={[
                        s.tagText,
                        form.district?.toLowerCase() === d.name.toLowerCase()
                          ? { color: "#FFFFFF" }
                          : { color: C.blue },
                      ]}
                    >
                      {d.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.row}>
                <Field
                  title="State"
                  value={form.state}
                  onChangeText={set("state")}
                />
                <Field
                  title="City / District *"
                  value={form.district}
                  onChangeText={set("district")}
                  placeholder="e.g. Patna"
                />
              </View>

              <View style={s.row}>
                <Field
                  title="Locality / Block"
                  value={form.block}
                  onChangeText={set("block")}
                  placeholder="e.g. Danapur"
                />
                <Field
                  title="Pincode"
                  value={form.pincode}
                  onChangeText={set("pincode")}
                  numeric
                  placeholder="e.g. 801503"
                />
              </View>

              <Button
                secondary
                title="Use Current GPS Location"
                icon="my-location"
                onPress={() =>
                  action.run(async () => {
                    const permission =
                      await Location.requestForegroundPermissionsAsync();
                    if (permission.status !== "granted")
                      throw new Error(
                        "Location permission denied. Enter coordinates manually.",
                      );
                    const location = await Location.getCurrentPositionAsync({
                      accuracy: Location.Accuracy.High,
                    });
                    set("lat")(String(location.coords.latitude));
                    set("lng")(String(location.coords.longitude));
                  })
                }
              />

              <View style={s.row}>
                <Field
                  title="Latitude *"
                  value={form.lat}
                  onChangeText={set("lat")}
                  numeric
                />
                <Field
                  title="Longitude *"
                  value={form.lng}
                  onChangeText={set("lng")}
                  numeric
                />
              </View>

              <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
                <Text style={s.h2}>Demarcate Property Boundary (Optional)</Text>
                <Text style={s.muted}>
                  Draw the boundary outline on the satellite map. Tap points around the plot corners to mark the perimeter.
                </Text>
                <View
                  style={{
                    minHeight: Platform.OS === "web" ? 480 : 420,
                    borderRadius: 16,
                    overflow: "hidden",
                    marginVertical: 12,
                    borderWidth: 1,
                    borderColor: C.line,
                  }}
                >
                  <MapParcelPicker
                    initialPoints={points}
                    onParcelChange={onParcelChange}
                    areaSqFt={form.totalArea || "2,400"}
                  />
                </View>
                <Field
                  title="Boundary description (North / South / East / West)"
                  placeholder="e.g. North: 30ft Road, South: Plot 42, East: Boundary wall, West: Green belt"
                  value={form.boundary}
                  onChangeText={set("boundary")}
                  multiline
                />
                <Field
                  title="Road width in front of plot (feet)"
                  placeholder="e.g. 30"
                  value={form.roadWidth}
                  onChangeText={set("roadWidth")}
                  numeric
                />
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={s.panel}>
              <Text style={s.h2}>Set your price & area</Text>
              
              <Field
                numeric
                title="Expected price (₹) *"
                placeholder="e.g. 4500000"
                value={form.price}
                onChangeText={set("price")}
              />
              {Number(form.price) > 0 && (
                <Text style={[s.small, { color: C.blue, fontWeight: "700", marginTop: -8 }]}>
                  Formatted Price: {money(Number(form.price))}
                </Text>
              )}

              <View style={s.row}>
                <Field
                  numeric
                  title="Total area (sq ft) *"
                  placeholder="e.g. 1800"
                  value={form.totalArea}
                  onChangeText={(v: string) => {
                    setForm((f: any) => ({
                      ...f,
                      totalArea: v,
                      sellableArea: (!f.sellableArea || f.sellableArea === f.totalArea) ? v : f.sellableArea,
                    }));
                  }}
                />
                <Field
                  numeric
                  title="Sellable area (sq ft)"
                  placeholder="e.g. 1800"
                  value={form.sellableArea}
                  onChangeText={set("sellableArea")}
                />
              </View>

              {[
                ["negotiable", "Price is negotiable"],
                ["hasLoan", "Property has an existing loan"],
                ["hasDispute", "Property has a dispute"],
              ].map(([key, title]) => (
                <Pressable
                  key={key}
                  style={s.row}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: form[key] }}
                  onPress={() => set(key)(!form[key])}
                >
                  <Icon
                    name={form[key] ? "check-box" : "check-box-outline-blank"}
                  />
                  <Text style={s.body}>{title}</Text>
                </Pressable>
              ))}

              <Text style={[s.fieldLabel, { marginTop: 8 }]}>Possession Status</Text>
              <View style={s.wrap}>
                {["Immediate", "Within 3 Months", "Under Construction", "With Owner"].map((pos) => (
                  <Button
                    key={pos}
                    title={pos}
                    secondary={form.possessionStatus !== pos}
                    onPress={() => set("possessionStatus")(pos)}
                  />
                ))}
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={s.panel}>
              <Text style={s.h2}>Photos & ownership documents</Text>
              <Text style={s.muted}>
                At least one property photo is required. Ownership documents remain confidential and private.
              </Text>

              <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
                <Button
                  secondary
                  title="Add property photos"
                  icon="add-a-photo"
                  onPress={() => action.run(() => pick())}
                />
                <Button
                  secondary
                  title="Add Demo Sample Photo"
                  icon="image"
                  onPress={addSamplePhoto}
                />
              </View>

              <View style={s.wrap}>
                {form.media?.photos?.map((uri: string, index: number) => (
                  <View key={uri + index} style={{ position: "relative" }}>
                    <Image
                      source={{ uri }}
                      style={{ width: 130, height: 95, borderRadius: 12, backgroundColor: "#E2E8F0" }}
                    />
                    <TouchableOpacity
                      onPress={() => removePhoto(index, false)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "#EF4444",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.map((p, index) => (
                  <View key={p.uri + index} style={{ position: "relative" }}>
                    <Image
                      source={{ uri: p.uri }}
                      style={{ width: 130, height: 95, borderRadius: 12, backgroundColor: "#E2E8F0" }}
                    />
                    <TouchableOpacity
                      onPress={() => removePhoto(index, true)}
                      style={{
                        position: "absolute",
                        top: -6,
                        right: -6,
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: "#EF4444",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <MaterialIcons name="close" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
                <Text style={s.h2}>Ownership documents (optional)</Text>
                <Button
                  secondary
                  title="Add ownership documents (PDF, JPG)"
                  icon="upload-file"
                  onPress={() => action.run(() => pick(true))}
                />
                {documents.map((d, index) => (
                  <View key={d.uri + index} style={[s.row, { justifyContent: "space-between", backgroundColor: "#F8FAFC", padding: 10, borderRadius: 8, marginVertical: 4 }]}>
                    <Text style={[s.small, { flex: 1 }]} numberOfLines={1}>
                      📄 {d.name}
                    </Text>
                    <TouchableOpacity onPress={() => removeDocument(index)}>
                      <MaterialIcons name="delete" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}

          {step === 5 && (
            <View style={s.panel}>
              <Text style={s.h2}>Assign your property team</Text>
              <Field
                title="Advisor ID (optional)"
                placeholder="Leave blank for automatic assignment"
                value={form.requestedAdvisorId}
                onChangeText={set("requestedAdvisorId")}
              />
              <Text style={s.muted}>
                Enter the Advisor ID if an Advisor assisted you. Leave it blank to automatically assign the next available verified staff.
              </Text>

              <View style={[s.panel, { backgroundColor: "#F8FAFC", gap: 8, marginVertical: 8 }]}>
                <Text style={s.cardTitle}>{form.title || `${form.type} in ${form.district || ""}`}</Text>
                <Text style={s.price}>{money(Number(form.price))}</Text>
                <Text style={s.body}>
                  📍 {form.block ? `${form.block}, ` : ""}{form.district}, {form.state} {form.pincode}
                </Text>
                <Text style={s.small}>
                  📐 Total Area: {form.totalArea} sq ft · Sellable: {form.sellableArea || form.totalArea} sq ft · Type: {form.type}
                </Text>
                {points.length >= 3 && (
                  <Text style={[s.small, { color: C.green, fontWeight: "600" }]}>
                    ✓ Boundary demarcated with {points.length} GPS points
                  </Text>
                )}
                {!!form.boundary && (
                  <Text style={[s.small, { color: C.muted }]}>
                    Boundary description: {form.boundary}
                  </Text>
                )}
                <Text style={[s.small, { color: C.muted }]}>
                  📷 {photos.length + (form.media?.photos?.length || 0)} photo(s) attached
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: approved(user) ? "#ECFDF5" : "#EFF6FF",
                  borderColor: approved(user) ? "#A7F3D0" : "#BFDBFE",
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Icon
                  name={approved(user) ? "verified" : "info"}
                  size={28}
                  color={approved(user) ? "#059669" : C.blue}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", color: approved(user) ? "#065F46" : "#1E40AF" }}>
                    {approved(user)
                      ? "Identity Verified Seller"
                      : "Demo Mode: Verification Auto-Completes on Submit"}
                  </Text>
                  <Text style={{ fontSize: 12, color: approved(user) ? "#047857" : "#3B82F6", marginTop: 2 }}>
                    {approved(user)
                      ? "Your account has full verified seller listing privileges."
                      : "You can click Submit directly, or verify beforehand."}
                  </Text>
                </View>
                {!approved(user) && (
                  <TouchableOpacity
                    onPress={() =>
                      action.run(async () => {
                        await authService.completeDemoKyc();
                      })
                    }
                    style={{
                      backgroundColor: C.blue,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>
                      Verify Now
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consent }}
                style={[s.row, { marginTop: 8 }]}
                onPress={() => setConsent(!consent)}
              >
                <Icon
                  name={consent ? "check-box" : "check-box-outline-blank"}
                />
                <Text style={[s.body, { flex: 1 }]}>
                  I am authorized to list this property and confirm that all its details, disclosures, and title representations are accurate.
                </Text>
              </Pressable>
            </View>
          )}

          <View style={s.between}>
            <Button
              title="Back"
              secondary
              disabled={step === 1 || action.busy}
              onPress={() => setStep(step - 1)}
            />
            <Button
              title={
                action.busy
                  ? "Submitting…"
                  : step === 5
                    ? "Submit for verification"
                    : "Continue →"
              }
              disabled={action.busy || (step === 5 && !consent)}
              onPress={() => (step === 5 ? submit() : goToNextStep())}
            />
          </View>
          {!!draftId && (
            <Text style={s.small}>
              Draft saved: {draftId}. Uploads are retained if submission needs to be retried.
            </Text>
          )}
        </>
      )}
    </MarketplaceShell>
  );
}
const font =
  Platform.OS === "web" ? "Manrope, Inter, system-ui" : "PoppinsRegular";
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
    backgroundColor: "white",
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    borderRadius: 18,
    padding: 6,
    boxShadow: "0 4px 16px rgba(11,27,63,0.05)",
  },
  searchSegmentLocation: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    minWidth: 180,
  },
  searchSegmentIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f0f6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  searchSegmentLabel: {
    fontFamily: font,
    fontSize: 9.5,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.6,
  },
  searchSegmentValue: {
    fontFamily: font,
    fontSize: 13.5,
    fontWeight: "700",
    color: C.ink,
  },
  searchDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 4,
  },
  searchSegmentInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  searchTextInput: {
    fontFamily: font,
    fontSize: 14,
    color: C.ink,
    padding: 0,
    outlineStyle: "none" as any,
  },
  searchSubmitBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.blue,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 13,
  },
  searchSubmitBtnText: {
    fontFamily: font,
    fontSize: 13.5,
    fontWeight: "700",
    color: "white",
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
