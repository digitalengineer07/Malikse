import { randomUUID } from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { isRunningInExpoGo } from "expo";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  Linking,
  KeyboardAvoidingView,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import {
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import Svg, { Rect } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import { currentMapLocation } from "../src/services/currentMapLocation";
import { validMapPoint, type MapFocus, type MapPoint } from "../src/utils/nativeMapHtml";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import { userService } from "../src/services/userService";
import { prepareUpload } from "../src/services/prepareUpload";
import EmailChangeForm from "./EmailChangeForm";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import MapParcelPicker, { LatLngPoint } from "./MapParcelPicker";
import PropertyImage from "./PropertyImage";
import { dashboardRoutes } from "../src/utils/accountRoutes";
const C = {
  bg: "#F7F4EC",
  ink: "#14263E",
  muted: "#536174",
  blue: "#14263E",
  sun: "#FCC61C",
  sunSoft: "#FFF1C0",
  line: "rgba(20, 38, 62, 0.12)",
  green: "#076c31",
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
      {icon && <Icon name={icon} size={17} />}
      <Text style={[s.buttonText, secondary && { color: C.blue }]}>
        {title}
      </Text>
    </Pressable>
  );
}
function Tag({ children, green = false }: any) {
  return (
    <View
      style={[
        s.tag,
        green && {
          backgroundColor: "#e8f7ee",
          borderColor: "rgba(7, 108, 49, 0.28)",
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[s.tagText, green && { color: "#076c31" }]}>{children}</Text>
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
  uppercaseLabel = false,
}: any) {
  return (
    <View style={{ flex: 1, minWidth: uppercaseLabel ? 0 : 140, gap: 5 }}>
      <Text style={[s.fieldLabel, uppercaseLabel && s.postFieldLabel]}>{title}</Text>
      <TextInput
        accessibilityLabel={title}
        style={[
          s.input,
          multiline && { minHeight: 90, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        placeholder={title}
        placeholderTextColor="#6f82a8"
      />
    </View>
  );
}
function useData(path: string | null, deps: any[] = []) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestKey = JSON.stringify([path, deps]);
  const [resultKey, setResultKey] = useState(requestKey);
  const refresh = useCallback(async () => {
    const [path] = JSON.parse(requestKey);
    if (!path) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(path);
      setResultKey(requestKey);
      setData(response.data);
      setNextCursor(response.headers["x-next-cursor"] || null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, [requestKey]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

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
      setNextCursor(response.headers["x-next-cursor"] || null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  return { data: resultKey === requestKey ? data : null, error, loading, refresh, setData, nextCursor, loadMore };
}
function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = useCallback(async (fn: () => Promise<any>) => {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }, []);
  return { busy, error, run };
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
  headerContent,
  headerAction,
  showDock = true,
  footer,
  profileHeader,
  step,
}: {
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  back?: boolean;
  headerContent?: React.ReactNode;
  headerAction?: React.ReactNode;
  showDock?: boolean;
  footer?: React.ReactNode;
  profileHeader?: React.ReactElement;
  step?: number;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter(),
    path = usePathname(),
    user = useAuthStore((x) => x.user);
  const focused = useIsFocused();
  const contextualTab =
    path === "/saved" ? ["/saved", "favorite-border", "Wishlist"] :
    path === "/my-properties" ? ["/my-properties", "apartment", "Listings"] :
    path.startsWith("/deal/") ? [path, "handshake", "Deal"] :
    ["/messages", "chat-bubble-outline", "Chats"];
  const scroll = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (step !== undefined) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {focused && <StatusBar style="light" />}
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={[s.scroll, !showDock && { paddingBottom: 12 }]}
        keyboardShouldPersistTaps="handled"
      >
      <View style={[s.hero, { paddingTop: insets.top + 14 }, profileHeader && s.profileHero]}>
        <View pointerEvents="none" style={s.heroSun} />
        <View pointerEvents="none" style={s.heroRay} />
        <View style={s.heroInner}>
        {profileHeader || <>
        <View style={s.header}>
        <View style={[s.row, { flex: 1 }]}>
          {back ? (
            <Pressable
              accessibilityLabel="Back"
              accessibilityRole="button"
              style={s.heroIcon}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/home")
              }
            >
              <Icon name="arrow-back" color="white" size={20} />
            </Pressable>
          ) : (
            <View style={s.logoIcon}>
              <Icon name="roofing" size={18} />
            </View>
          )}
          <Pressable onPress={() => router.push("/home")}>
            <Text style={s.logo}>
              MalikSe<Text style={{ color: C.sun }}>.</Text>
            </Text>
          </Pressable>
        </View>
        {headerAction || <>
        <Pressable
          accessibilityLabel="Wishlist"
          accessibilityRole="button"
          style={s.heroIcon}
          onPress={() => router.push("/saved")}
        >
          <Icon name="favorite-border" color="white" size={20} />
        </Pressable>
        <Pressable
          accessibilityLabel="Profile"
          accessibilityRole="button"
          onPress={() => router.push("/profile")}
          style={s.avatar}
        >
          {user?.name?.[0] ? <Text style={s.avatarText}>{user.name[0]}</Text> : <Icon name="person-outline" size={19} />}
        </Pressable>
        </>}
        </View>
          {Boolean(title) && (
            <View style={{ gap: 4 }}>
              <Text accessibilityRole="header" style={s.heroTitle}>{title}</Text>
              {Boolean(subtitle) && <Text style={s.heroSubtitle}>{subtitle}</Text>}
            </View>
          )}
          {headerContent}
        </>}
        </View>
      </View>
        <View style={[s.content, profileHeader && s.profileContent]}>
          {children}
        </View>
      </ScrollView>
      {footer && <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>}
      {showDock && <View
        style={[s.dockWrapper, { bottom: Math.max(insets.bottom, 8), pointerEvents: "box-none" }]}
      >
        <View style={s.nav}>
          {[
            ["/home", "home", "Home"],
            ["/search", "search", "Search"],
            ["/post", "add", "Post"],
            contextualTab,
            ["/profile", "person-outline", "Profile"],
          ].map(([url, icon, text]) => {
            const isActive = path === url;
            const isPost = url === "/post";
            return (
              <Pressable
                key={url}
                accessibilityRole="button"
                accessibilityLabel={text}
                onPress={() => {
                  if (!isActive) router.push(url as any);
                }}
                accessibilityState={{ selected: isActive }}
                style={s.navItem}
              >
                {isPost ? (
                  <View style={s.postCircle}>
                    <Icon name="add" color={C.ink} size={24} />
                  </View>
                ) : (
                  <View style={s.navGlyph}>
                    {isActive && (
                      <Svg width={48} height={32} viewBox="0 0 48 32" style={StyleSheet.absoluteFill} pointerEvents="none">
                        <Rect width={48} height={32} rx={16} fill={C.sun} />
                      </Svg>
                    )}
                    <Icon name={icon} color={isActive ? C.ink : "#C7A532"} size={20} />
                  </View>
                )}
                <Text
                  style={[
                    s.navText,
                    isActive && { color: C.sun },
                  ]}
                >
                  {text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>}
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
          <Tag green>✓ Verified Owner</Tag>
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
            style={[s.heartBtn, saved && { backgroundColor: C.sun }]}
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
            <Icon name={saved ? "favorite" : "favorite-border"} color={C.ink} size={18} />
          </Pressable>
        </View>
        <Pressable onPress={() => router.push(`/property/${p._id}` as any)}>
          <Text style={s.cardTitle} numberOfLines={1}>{label(p)}</Text>
        </Pressable>
        <Text style={s.muted} numberOfLines={1}>
          ⌖ {p.location?.district}, {p.location?.state}
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
    <MarketplaceShell
      title={<>Find a home,{"\n"}<Text style={{ color: C.sun }}>direct from the owner.</Text></>}
      headerContent={
        <View style={[s.row, { alignSelf: "flex-start" }]}>
          <Icon name="location-on" size={18} color={C.sun} />
          <Text style={s.heroSubtitle}>{prefs.district || "Explore properties near you"}</Text>
        </View>
      }
    >
      <View style={s.panel}>
        <View style={s.row}>
          <View style={[s.input, s.row, { flex: 1, backgroundColor: "#ffffff" }]}>
            <Icon name="search" size={19} />
            <TextInput
              accessibilityLabel="Search location"
              placeholder="Search city, locality or property"
              placeholderTextColor="#6f82a8"
              value={query}
              onChangeText={setQuery}
              style={{ flex: 1, color: C.ink, fontSize: 13.5 }}
              onSubmitEditing={() =>
                router.push({
                  pathname: "/search",
                  params: { q: query, type },
                } as any)
              }
            />
          </View>
          <Button
            title="Search"
            onPress={() =>
              router.push({
                pathname: "/search",
                params: { q: query, type },
              } as any)
            }
          />
        </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {types.map(([id, text, icon]) => (
          <Pressable
            key={id}
            onPress={() => setType(type === id ? "" : id)}
            style={[s.typeChip, type === id && { backgroundColor: C.blue }]}
          >
            <Icon name={icon} color={type === id ? C.sun : C.blue} size={16} />
            <Text style={[s.small, { color: type === id ? C.sun : C.ink }]}>{text}</Text>
          </Pressable>
        ))}
      </ScrollView>
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
      ].map(([title, sub, feed]: any) => {
        const listings = (feed.data || []).filter((p: any) => !type || p.type === type).slice(0, 6);
        const carousel = title === "Recommended for You" && width < 650;
        return (
        <View key={title} style={{ gap: 14 }}>
          <View style={s.between}>
            <View style={{ flex: 1 }}>
              <Text style={s.h2}>{title}</Text>
              <Text style={s.small}>{sub}</Text>
            </View>
            <Pressable onPress={() => router.push({ pathname: "/search", params: { type } })}>
              <Text style={s.link}>View all →</Text>
            </Pressable>
          </View>
          {feed.loading ? (
            <ActivityIndicator color={C.blue} />
          ) : feed.error ? (
            <ErrorBox text={feed.error} />
          ) : !listings.length ? (
            <Empty
              title={type ? "No listings in this category" : "Properties are on their way"}
              text={type ? "Choose another property type to see more listings." : "Verified listings will appear here as they become available."}
            />
          ) : (
            <ScrollView horizontal={carousel} scrollEnabled={carousel} showsHorizontalScrollIndicator={false}
              contentContainerStyle={carousel ? { gap: 14 } : s.grid}>
              {listings.map((p: any) => (
                  <View
                    key={p._id}
                    style={{
                      width:
                        width > 1000 ? "31.8%" : width > 650 ? "48.5%" :
                          title === "Recommended for You" ? Math.min(width - 64, 320) :
                          title === "Trending Properties" && width >= 360 ? "47.5%" : "100%",
                    }}
                  >
                    <PropertyCard
                      property={p}
                      compact={title === "New Properties" && width < 650}
                    />
                  </View>
                ))}
            </ScrollView>
          )}
        </View>
        );
      })}
      <View style={[s.panel, { backgroundColor: C.sunSoft }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.h2}>List your property</Text>
          <Text style={s.muted}>
            Your assigned team helps with questions, offers and deal closure.
          </Text>
        </View>
        <Button title="Post property" icon="add" onPress={() => router.push("/post")} />
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
  const { height } = useWindowDimensions();
  const properties = feed.data || [];
  const visibleSelection = selected && properties.find((property: any) => property._id === selected._id);
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
      title="Search properties"
      headerContent={
      <View style={s.wrap}>
        <View style={[s.input, s.row, { flex: 1, minWidth: 140, backgroundColor: "#ffffff" }]}>
          <Icon name="search" size={19} />
          <TextInput
            accessibilityLabel="Search properties"
            value={query}
            onChangeText={setQuery}
            placeholder="Locality, project or city"
            placeholderTextColor="#6f82a8"
            onSubmitEditing={search}
            style={{ flex: 1, color: C.ink, fontSize: 13.5 }}
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
      }
    >
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
        <View style={[s.map, { height: Math.max(400, height * 0.57) }]}>
          <VerifiedPropertyMap properties={properties} onSelect={select} />
        </View>
      )}
      {visibleSelection && map && (
        <View style={s.panel}>
          <PropertyCard property={visibleSelection} compact />
          <Button
            title="View full property details"
            onPress={() => router.push(`/property/${visibleSelection._id}` as any)}
          />
        </View>
      )}
      {(!map || !visibleSelection) && (
        <View style={s.grid}>
          {(feed.data || []).map((p: any) => (
            <View style={{ minWidth: 270, flex: 1, maxWidth: 520 }} key={p._id}>
              <PropertyCard property={p} />
            </View>
          ))}
        </View>
      )}
      {Boolean(feed.nextCursor) && (
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
      title="Wishlist"
      subtitle={feed.data ? `${rows.length}${feed.nextCursor ? "+" : ""} saved properties` : undefined}
      headerAction={user ? <Button secondary icon="sort" title={sort ? "Newest saved" : "Sort by price"} onPress={() => setSort(!sort)} /> : undefined}
      back
    >
      <Protected>
        <ErrorBox text={feed.error} />
        {feed.loading && <ActivityIndicator />}
        {rows.map((p) => (
          <PropertyCard
            key={p._id}
            property={p}
            compact
            initiallySaved
            onSaved={feed.refresh}
          />
        ))}
        {Boolean(feed.nextCursor) && (
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
  const { language, setLanguage } = useLanguageStore();
  const [openPreference, setOpenPreference] = useState<"language" | "notifications" | null>(null);
  const notificationSettingsAvailable = Platform.OS !== "web" && !isRunningInExpoGo();
  const listings = useData(user?.role === "user" ? "/properties/mine" : null, [user?.id]);
  const wishlist = useData(user ? "/users/wishlist" : null, [user?.id]);
  const kyc = useData(user ? "/users/kyc" : null, [user?.id]);
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase();
  const listingCount = listings.data ? `${listings.data.length}${listings.nextCursor ? "+" : ""}` : null;
  const savedCount = wishlist.data ? `${wishlist.data.length}${wishlist.nextCursor ? "+" : ""}` : null;
  const listingSummary = listings.data && !listings.nextCursor
    ? `${listings.data.filter((property: any) => property.status === "verified").length} active · ${listings.data.filter((property: any) => ["queued", "pending", "advisor_verified"].includes(property.status)).length} under review`
    : "Manage properties and track reviews";
  const kycLabel = approved(user) || kyc.data?.isVerifiedIdentity ? "Verified" :
    kyc.data?.kycStatus === "pending" ? "In review" :
      kyc.data?.kycStatus === "correction_required" ? "Action needed" :
        kyc.data?.kycStatus === "rejected" ? "Rejected" :
          kyc.data ? "Not submitted" : null;

  const openEditor = () => {
    if (editing) {
      setEditing(false);
      return;
    }
    setName(user?.name || "");
    setEmail(user?.email || "");
    setEditing(true);
  };
  const profileHeader = user ? (
    <>
      <View style={s.between}>
        <Text accessibilityRole="header" style={s.heroTitle}>Profile</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit profile"
          accessibilityState={{ expanded: editing }} onPress={openEditor} style={s.profileEdit}>
          <Icon name="edit" color={C.sun} />
        </Pressable>
      </View>
      <View style={s.profileIdentity}>
        <View style={s.profilePortrait}>
          {initials ? <Text style={s.profileInitials}>{initials}</Text> : <Icon name="person-outline" color={C.sun} size={32} />}
        </View>
        <View style={s.profileDetails}>
          <Text style={s.profileName}>{user.name}</Text>
          {!!user.mobile && <Text style={s.heroSubtitle}>{/^\d{10}$/.test(user.mobile) ? `+91 ${user.mobile}` : user.mobile}</Text>}
          {!!user.email && <Text style={s.heroSubtitle}>{user.email}</Text>}
          <Pressable accessibilityRole="button" accessibilityLabel="Identity verification"
            style={s.profileVerification} onPress={() => router.push("/kyc")}>
            <Icon name="verified-user" size={17} color={kycLabel === "Verified" ? C.green : C.ink} />
            <Text style={[s.cardTitle, { flexShrink: 1 }, kycLabel === "Verified" && { color: C.green }]}>
              {kycLabel === "Verified" ? "Identity verified" : kycLabel || "Identity verification"}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  ) : undefined;
  return (
    <MarketplaceShell title="Profile" profileHeader={profileHeader}>
      <Protected>
        {user && (
          <>
            <View style={s.profileStats}>
              {[
                { label: "Listings", value: listingCount, onPress: user.role === "user" ? () => router.push("/my-properties") : undefined },
                { label: "Saved", value: savedCount, onPress: () => router.push("/saved") },
                { label: "Rating", value: null, onPress: undefined },
              ].map(({ label, value, onPress }) => (
                <Pressable key={label} disabled={!onPress} accessibilityRole={onPress ? "button" : undefined}
                  accessibilityLabel={value == null ? `${label} unavailable` : `${value} ${label}`}
                  style={[s.profileStat, label !== "Listings" && s.profileDivider]} onPress={onPress}>
                  <Text style={s.profileStatValue}>{value ?? "—"}</Text>
                  <Text style={s.muted}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={s.profileMenu}>
              {[
                { title: "Profile", icon: "person-outline", sub: "Name, phone and email", onPress: openEditor },
                ...(user.role === "user" ? [{
                  title: "My listings", icon: "apartment", sub: listingSummary, badge: listingCount,
                  onPress: () => router.push("/my-properties"),
                }] : []),
                { title: "KYC verification", icon: "badge", sub: "Identity and documents", badge: kycLabel, onPress: () => router.push("/kyc") },
                { title: "Wishlist", icon: "favorite-border", sub: savedCount == null ? "Your saved properties" : `${savedCount} saved properties`, badge: savedCount, onPress: () => router.push("/saved") },
              ].map(({ title, icon, sub, badge, onPress }, index) => (
                <Pressable key={title} accessibilityRole="button" onPress={onPress}
                  style={[s.preferenceRow, index > 0 && s.preferenceSeparator]}>
                  <View style={s.preferenceIcon}><Icon name={icon} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.profileMenuTitle}>{title}</Text>
                    <Text style={s.muted}>{sub}</Text>
                  </View>
                  {badge != null ? (
                    <View style={[s.profileBadge, title === "KYC verification" && s.profileKycBadge]}>
                      <Text style={[s.profileBadgeText, title === "KYC verification" && { color: C.ink }]}>{badge}</Text>
                    </View>
                  ) : (
                    <View style={s.profileChevron}><Icon name="chevron-right" size={19} /></View>
                  )}
                </Pressable>
              ))}
            </View>
            {editing && (
              <View style={s.panel}>
                <Text style={s.h2}>Edit profile</Text>
                <Field title="Full name" value={name} onChangeText={setName} />
                <Field title="New email" value={email} onChangeText={setEmail} />
                <EmailChangeForm email={email} />
                <Button
                  title="Save profile"
                  disabled={action.busy}
                  onPress={() =>
                    action.run(async () => {
                      await userService.updateProfile({ name });
                      await authService.getMe();
                      setEditing(false);
                    })
                  }
                />
              </View>
            )}
            <Text style={s.h2}>Preferences</Text>
            <View style={s.profileMenu}>
              {[
                {
                  title: "Notifications", subtitle: "Advisor replies & deal updates", icon: "notifications-none",
                  expanded: notificationSettingsAvailable ? undefined : openPreference === "notifications",
                  onPress: () => {
                    if (notificationSettingsAvailable) void action.run(() => Linking.openSettings());
                    else setOpenPreference(current => current === "notifications" ? null : "notifications");
                  },
                },
                {
                  title: "Language", subtitle: "English · हिंदी", icon: "language",
                  expanded: openPreference === "language",
                  onPress: () => setOpenPreference(current => current === "language" ? null : "language"),
                },
                {
                  title: "Help & support", subtitle: "Talk to the MalikSe team", icon: "help-outline",
                  onPress: () => void action.run(() => Linking.openURL("mailto:support@malikse.in")),
                },
              ].map(({ title, subtitle, icon, expanded, onPress }, index) => (
                <React.Fragment key={title}>
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded }}
                    onPress={onPress} style={[s.preferenceRow, index > 0 && s.preferenceSeparator]}>
                    <View style={s.preferenceIcon}><Icon name={icon} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.profileMenuTitle}>{title}</Text>
                      <Text style={s.muted}>{subtitle}</Text>
                    </View>
                    <View style={s.profileChevron}><Icon name={expanded ? "expand-less" : "chevron-right"} size={19} /></View>
                  </Pressable>
                  {expanded && title === "Notifications" && (
                    <Text style={[s.muted, s.preferenceDetails]}>Push notifications are available in the installed MalikSe app.</Text>
                  )}
                  {expanded && title === "Language" && (
                    <View style={[s.wrap, s.preferenceDetails]}>
                      {([{ id: "en", label: "English" }, { id: "hi", label: "हिंदी" }] as const).map(option => (
                        <Pressable key={option.id} accessibilityRole="radio" accessibilityState={{ checked: language === option.id }}
                          onPress={() => { setLanguage(option.id); setOpenPreference(null); }}
                          style={[s.typeChip, language === option.id && { backgroundColor: C.sunSoft }]}>
                          <Text style={s.cardTitle}>{option.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </React.Fragment>
              ))}
            </View>
            <Button title="Conversations" icon="chat-bubble-outline" secondary onPress={() => router.push("/messages")} />
            {user.role !== "user" && <Button title="Staff dashboard" icon="dashboard" secondary onPress={() => router.push(dashboardRoutes[user.role] as any)} />}
            <Button title="Privacy policy" secondary onPress={() => action.run(() => Linking.openURL("https://malikse.devoxa.in/privacy-policy"))} />
            {user.role === "user" && <Button title="Delete account" secondary onPress={() => router.push("/delete-account" as any)} />}
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
  const groups = [
    { id: "all", label: "All listings", status: null },
    { id: "verified", label: "Verified", status: ["verified"] },
    { id: "review", label: "In review", status: ["queued", "pending", "advisor_verified"] },
  ].map(group => ({
    ...group,
    rows: (feed.data || []).filter((property: any) => !group.status || group.status.includes(property.status)),
  }));
  const [activeGroup, setActiveGroup] = useState("all");
  const visible = groups.find(group => group.id === activeGroup)?.rows ?? groups[0].rows;
  return (
    <MarketplaceShell
      title="My listings"
      subtitle="Manage your properties"
      headerAction={<Button title="Post new" icon="add" onPress={() => router.push("/post")} />}
      back
    >
      <Protected>
        {feed.data && <View style={[s.panel, s.row]}>
          {groups.map(group => (
            <Pressable
              key={group.id}
              style={[s.stat, activeGroup === group.id && { backgroundColor: C.sunSoft }]}
              accessibilityRole="button"
              accessibilityState={{ selected: activeGroup === group.id }}
              onPress={() => setActiveGroup(group.id)}
            >
              <Text style={s.price}>{group.rows.length}{feed.nextCursor ? "+" : ""}</Text>
              <Text style={s.small}>{group.label}</Text>
            </Pressable>
          ))}
        </View>}
        <ErrorBox text={feed.error} />
        {feed.loading && <ActivityIndicator />}
        {visible.map((p: any) => (
          <View key={p._id} style={s.panel}>
            <View style={s.row}>
              {p.media?.photos?.[0] ? (
                <PropertyImage source={{ uri: p.media.photos[0] }} style={s.listingPhoto} resizeMode="cover" thumbnailWidth={240} />
              ) : (
                <View style={[s.listingPhoto, s.placeholder]}><Icon name="home-work" size={30} /></View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Tag green={p.status === "verified"}>{p.status.replaceAll("_", " ")}</Tag>
                <Text style={s.cardTitle}>{label(p)}</Text>
                <Text style={s.muted}>{[p.location?.district, p.totalArea ? `${p.totalArea} sq ft` : null].filter(Boolean).join(" · ")}</Text>
                <Text style={s.price}>{money(p.price)}</Text>
              </View>
            </View>
            {Boolean(p.rejectionReason) && <ErrorBox text={p.rejectionReason} />}
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
        {feed.data?.length > 0 && visible.length === 0 && (
          <Empty title="No matching listings" text={feed.nextCursor ? "Load more properties to see additional listings." : "Choose All listings to view your other properties."} />
        )}
        {Boolean(feed.nextCursor) && (
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
      title="KYC verification"
      subtitle="Verify your identity to sell, make offers and contact staff."
      back
      showDock={false}
      footer={user && feed.data && !feed.data.isVerifiedIdentity && feed.data.kycStatus !== "pending" ? (
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
      ) : undefined}
    >
      <Protected>
        <View style={[s.panel, s.kycSummary]}>
          <View style={s.row}>
            <View style={s.featureIcon}><Icon name="verified-user" size={26} /></View>
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
          <Text style={s.body}>
            Your documents are private and reviewed by authorized staff.
            Submission does not automatically approve your identity.
          </Text>
          {Boolean(feed.data?.identityReview?.notes) && (
            <Text style={s.muted}>{feed.data.identityReview.notes}</Text>
          )}
        </View>
        <ErrorBox text={feed.error || action.error} />
        {feed.loading && <ActivityIndicator color={C.ink} />}
        {feed.data && !feed.data.isVerifiedIdentity &&
          feed.data.kycStatus !== "pending" && (
            <View style={s.panel}>
              <Text style={s.h2}>Identity documents</Text>
              <Text style={s.muted}>
                Upload clear identity documents. JPG, PNG or PDF, up to 5 MB
                each; maximum 3 files.
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose identity documents"
                disabled={action.busy} style={s.uploadTarget}
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
              >
                <View style={s.featureIcon}><Icon name="cloud-upload" size={24} /></View>
                <Text style={s.cardTitle}>{files.length ? "Replace documents" : "Tap to upload documents"}</Text>
                <Text style={s.muted}>JPG, PNG or PDF</Text>
              </Pressable>
              {files.map((f) => (
                <View key={f.uri} style={s.documentRow}><Icon name="description" size={18} /><Text style={[s.body, { flex: 1 }]}>{f.name}</Text></View>
              ))}
            </View>
          )}
        {feed.data?.isVerifiedIdentity && (
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
    [galleryIndex, setGalleryIndex] = useState(0),
    [amount, setAmount] = useState(""),
    [message, setMessage] = useState("I am interested in this property."),
    action = useAction(),
    p = feed.data;
  const userId = useAuthStore((state) => state.user?.id);
  const wishlist = useData(userId && id ? `/users/wishlist/${id}` : null, [userId]);
  const saved = Boolean(wishlist.data?.isWishlisted);
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
  const photos: string[] = p?.media?.photos || [];
  const activePhoto = Math.min(galleryIndex, Math.max(0, photos.length - 1));
  const checks = [
    ["identityVerified", "Owner identity verified"],
    ["documentsChecked", "Property documents checked"],
    ["siteVisited", "Site visit completed"],
    ["lawyerReviewed", "Reviewed by a lawyer"],
  ].filter(([key]) => p?.badges?.[key]);
  return (
    <MarketplaceShell title="Property details" back showDock={false}
      footer={p && (
        <View style={s.between}>
          <Text style={s.price}>{money(p.price)}</Text>
          <Button title="Chat with assigned staff" icon="chat-bubble-outline" disabled={action.busy} onPress={() => contact()} />
        </View>
      )}
    >
      <ErrorBox text={feed.error || action.error || wishlist.error} />
      {feed.loading && <ActivityIndicator />}
      {p && (
        <>
          <View
            style={[
              s.photo,
              { height: 340, borderRadius: 24, overflow: "hidden" },
            ]}
          >
            {photos.length ? (
              <PropertyImage isPublic
                source={{ uri: photos[activePhoto] }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, s.placeholder]}>
                <Icon name="home-work" size={70} />
              </View>
            )}
            {photos.length > 0 && <Text style={s.photoCounter}>{activePhoto + 1} / {photos.length} photos</Text>}
            <View style={s.imageTags}>
              <Tag green>✓ Verified property</Tag>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={saved ? "Remove from wishlist" : "Save property"}
              accessibilityState={{ selected: saved }}
              disabled={action.busy || wishlist.loading}
              style={[s.heartBtn, s.gallerySave, saved && { backgroundColor: C.sun }]}
              onPress={() => {
                if (!gate() || typeof id !== "string") return;
                void action.run(async () => {
                  const result = await userService.toggleWishlist(id);
                  wishlist.setData(result);
                  if (result.isWishlisted) {
                    void api.post(`/recommendations/${id}/activity`, { kind: "save" }).catch(() => {});
                  }
                });
              }}
            >
              <Icon name={saved ? "favorite" : "favorite-border"} size={19} />
            </Pressable>
          </View>
          {photos.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {photos.map((uri, index) => (
                <Pressable key={`${uri}-${index}`} accessibilityRole="button"
                  accessibilityLabel={`View photo ${index + 1}`}
                  accessibilityState={{ selected: index === activePhoto }}
                  onPress={() => setGalleryIndex(index)} style={[s.galleryThumb, index === activePhoto && { borderColor: C.sun }]}>
                  <PropertyImage isPublic source={{ uri }} style={StyleSheet.absoluteFill} />
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={s.panel}>
            <Text style={[s.price, { fontSize: 22, lineHeight: 28 }]}>{money(p.price)}</Text>
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
          {checks.length > 0 && <View style={[s.panel, s.kycSummary]}>
            <Text style={s.h2}>Why you can trust this listing</Text>
            {checks.map(([key, title]) => (
              <View key={key} style={s.row}><Icon name="check-circle" size={19} color={C.green} /><Text style={s.body}>{title}</Text></View>
            ))}
          </View>}
          <View style={s.panel}>
            <Text style={s.h2}>About this property</Text>
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
          </View>
          <View style={s.panel}>
            <Text style={s.h2}>Location</Text>
            <View style={s.map}><VerifiedPropertyMap properties={[p]} onSelect={() => {}} /></View>
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
    [query, setQuery] = useState(""),
    [unreadOnly, setUnreadOnly] = useState(false),
    feed = useData(user ? "/inquiries" : null, [user?.id]),
    chat = useData(user && selected ? `/inquiries/${selected}` : null, [
      user?.id,
    ]),
    messages = useData(
      user && selected ? `/inquiries/${selected}/messages` : null,
      [user?.id],
    ),
    action = useAction();
  const [previousInquiry, setPreviousInquiry] = useState(params.inquiryId);
  if (params.inquiryId !== previousInquiry) { setPreviousInquiry(params.inquiryId); if (params.inquiryId) setSelected(String(params.inquiryId)); }
  const refreshMessages = messages.refresh, refreshChat = chat.refresh;
  const userId = user?.id;
  useEffect(() => {
    if (!selected || !userId) return;
    const timer = setInterval(() => {
      void refreshMessages();
      void refreshChat();
    }, 7000);
    return () => clearInterval(timer);
  }, [selected, userId, refreshMessages, refreshChat]);
  useEffect(() => {
    if (chat.data && messages.data) {
      const latest =
        messages.data.messages?.at(-1)?.createdAt || chat.data.createdAt;
      if (latest)
        void api
          .post(`/inquiries/${selected}/read`, { through: latest })
          .catch(() => {});
    }
  }, [messages.data, chat.data, selected]);
  const c = chat.data,
    other = c && (identity(c.buyerId) === user?.id ? c.staffId : c.buyerId);
  const search = query.trim().toLocaleLowerCase();
  const threads = (feed.data || []).filter((thread: any) => {
    if (unreadOnly && !thread.unread) return false;
    const participant = identity(thread.buyerId) === user?.id ? thread.staffId : thread.buyerId;
    return !search || [participant?.name, thread.propertyId?.title, thread.messages?.at(-1)?.text || thread.message]
      .some(value => typeof value === "string" && value.toLocaleLowerCase().includes(search));
  });
  return (
    <MarketplaceShell
      title={selected ? other?.name || "Property conversation" : "Messages"}
      subtitle={selected ? c?.propertyId?.title : undefined}
      back
      showDock={!selected}
      headerAction={selected ? <Button secondary title="All messages" onPress={() => {
        setSelected("");
        setText("");
        void feed.refresh();
      }} /> : undefined}
      footer={selected && c && c.propertyId?.status !== "sold" ? (
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
      ) : undefined}
      headerContent={!selected && user ? (
        <View style={[s.input, s.row]}>
          <Icon name="search" size={20} />
          <TextInput accessibilityLabel="Search chats or properties" placeholder="Search chats or properties"
            placeholderTextColor={C.muted} value={query} onChangeText={setQuery}
            style={[s.body, { flex: 1 }]} />
        </View>
      ) : undefined}
    >
      <Protected>
        <ErrorBox
          text={feed.error || chat.error || messages.error || action.error}
        />
        {selected ? (
          <>
            {!c && !chat.error && <ActivityIndicator color={C.ink} />}
            {c && (
              <>
                <View style={[s.panel, s.row]}>
                  <View style={s.featureIcon}><Icon name="home-work" size={24} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.small}>Chatting about</Text>
                    <Text style={s.cardTitle}>
                      {c.propertyId?.title || "Property conversation"}
                    </Text>
                  </View>
                  <Tag green>
                    {c.propertyId?.status === "sold" ? "Sold" : c.status}
                  </Tag>
                </View>
                {c.dealId && (
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
                    {Boolean(c.offerAmount) && (
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
                {c.propertyId?.status === "sold" && <Tag>This property is sold. Conversation is read-only.</Tag>}
              </>
            )}
          </>
        ) : (
          <>
            {feed.loading && <ActivityIndicator />}
            <View style={s.wrap}>
              <Button title="All" secondary={unreadOnly} onPress={() => setUnreadOnly(false)} />
              <Button title="Unread" secondary={!unreadOnly} onPress={() => setUnreadOnly(true)} />
            </View>
            {threads.map((c: any) => {
              const staff = identity(c.buyerId) === user?.id,
                other = staff ? c.staffId : c.buyerId;
              return (
                <Pressable
                  key={c._id}
                  accessibilityRole="button"
                  onPress={() => { setSelected(c._id); setText(""); }}
                  style={[s.panel, s.row, c.unread && { borderColor: C.sun }]}
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
                  <View style={{ alignItems: "flex-end", gap: 6 }}>
                    {c.messages?.at(-1)?.createdAt || c.createdAt ? <Text style={s.small}>
                      {new Date(c.messages?.at(-1)?.createdAt || c.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </Text> : null}
                    {c.unread && <View accessibilityLabel="Unread" style={s.dot} />}
                  </View>
                </Pressable>
              );
            })}
            {Boolean(feed.nextCursor) && (
              <Button
                title="Load more conversations"
                secondary
                disabled={feed.loading}
                onPress={feed.loadMore}
              />
            )}
            {feed.data?.length > 0 && threads.length === 0 && <Empty title="No matching conversations" text="Try another search or filter." />}
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
function PostSection({ number, title, children }: { number?: number; title: string; children: React.ReactNode }) {
  return (
    <View style={[s.panel, s.postSection]}>
      <View style={s.row}>
        {number != null && <View style={s.postSectionNumber}><Text style={s.postSectionNumberText}>{number}</Text></View>}
        <Text accessibilityRole="header" style={[s.h2, { flex: 1 }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const postDocumentOptions = [
  { type: "Registry", title: "Sale deed / title document", subtitle: "Optional · PDF, JPG or PNG" },
  { type: "Utility or Tax Bill", title: "Electricity or tax bill", subtitle: "Optional · Supporting proof" },
] as const;
type PostDocumentType = (typeof postDocumentOptions)[number]["type"];
type PostDocument = { asset: DocumentPicker.DocumentPickerAsset; type: PostDocumentType };

export function PostScreen() {
  const router = useRouter(),
    params = useLocalSearchParams(),
    user = useAuthStore((x) => x.user),
    [draftId, setDraftId] = useState(String(params.id || "")),
    [showCoordinates, setShowCoordinates] = useState(false),
    [parcelFocus, setParcelFocus] = useState<MapFocus>(),
    [step, setStep] = useState(1),
    [done, setDone] = useState(false),
    [consent, setConsent] = useState(false),
    [points, setPoints] = useState<LatLngPoint[]>([]),
    [photos, setPhotos] = useState<DocumentPicker.DocumentPickerAsset[]>([]),
    [documents, setDocuments] = useState<PostDocument[]>([]),
    [form, setForm] = useState<any>({
      title: "",
      description: "",
      streetAddress: "",
      type: "flat",
      state: "",
      district: "",
      block: "",
      pincode: "",
      lat: "",
      lng: "",
      price: "",
      totalArea: "",
      sellableArea: "",
      boundary: "",
      roadWidth: "",
      requestedAdvisorId: "",
      negotiable: true,
      hasLoan: false,
      hasDispute: false,
      possessionStatus: "With Owner",
      media: { photos: [], videos: [] },
    }),
    action = useAction();
  const set = (key: string) => (value: any) =>
    setForm((f: any) => ({ ...f, [key]: value }));

  const onParcelChange = useCallback((next: LatLngPoint[]) => {
    setPoints(next);
    if (next.length) {
      setForm((f: any) => f.lat && f.lng ? f : ({
        ...f,
        lat: String(next[0].lat),
        lng: String(next[0].lng),
      }));
    }
  }, []);
  const setPropertyLocation = useCallback((point: MapPoint) => {
    setForm((current: any) => ({ ...current, lat: String(point.lat), lng: String(point.lng) }));
  }, []);
  const formLocation = { lat: Number(form.lat), lng: Number(form.lng) };
  const selectedLocation = form.lat?.trim() && form.lng?.trim() && validMapPoint(formLocation) ? formLocation : undefined;

  const runAction = action.run;
  const editorUserId = user?.id;
  useEffect(() => {
    if (params.id && editorUserId)
      void runAction(async () => {
        const p = (await api.get(`/properties/${params.id}/workspace`)).data;
        if (p.parcelPoints && Array.isArray(p.parcelPoints)) {
          setPoints(p.parcelPoints);
        }
        setForm({
          ...p,
          ...p.location,
          ...p.disclosures,
          price: String(p.price),
          totalArea: String(p.totalArea),
          sellableArea: String(p.sellableArea),
          lat: String(p.location.lat),
          lng: String(p.location.lng),
          boundary: p.boundary || "",
          roadWidth: p.roadWidth ? String(p.roadWidth) : "",
          requestedAdvisorId: p.requestedAdvisorId || "",
        });
      });
  }, [params.id, editorUserId, runAction]);
  const pick = async (documentType?: PostDocumentType) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: documentType
        ? ["application/pdf", "image/jpeg", "image/png"]
        : ["image/jpeg", "image/png", "image/webp"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    if (documentType) {
      setDocuments(current => [
        ...current.filter(document => document.type !== documentType),
        ...result.assets.map(asset => ({ asset, type: documentType })),
      ]);
      return;
    }
    setPhotos(current => {
      const unique = new Map([...current, ...result.assets].map(asset => [asset.uri, asset]));
      return [...unique.values()].slice(0, Math.max(0, 10 - (form.media?.photos?.length || 0)));
    });
  };
  const uploadKeys = useRef(new Map<string, string>());
  const uploadKey = (uri: string) => {
    if (!uploadKeys.current.has(uri)) uploadKeys.current.set(uri, randomUUID());
    return uploadKeys.current.get(uri)!;
  };
  const submit = () =>
    action.run(async () => {
      if (!consent)
        throw new Error("Accept the declaration before submitting.");
      if (points.length > 0 && points.length < 3)
        throw new Error("Complete the boundary with at least 3 points, or clear it.");
      const payload = {
        title: form.title,
        description: form.description,
        bedrooms: form.bedrooms,
        bathrooms: form.bathrooms,
        furnishing: form.furnishing,
        streetAddress: form.streetAddress,
        type: form.type,
        location: {
          state: form.state,
          district: form.district,
          block: form.block,
          pincode: form.pincode,
          lat: Number(form.lat),
          lng: Number(form.lng),
        },
        price: Number(form.price),
        totalArea: Number(form.totalArea),
        sellableArea: Number(form.sellableArea),
        boundary: form.boundary || undefined,
        roadWidth: form.roadWidth ? Number(form.roadWidth) : undefined,
        parcelPoints: points.length ? points : undefined,
        requestedAdvisorId: form.requestedAdvisorId.trim(),
        negotiable: form.negotiable,
        disclosures: {
          hasLoan: form.hasLoan,
          hasDispute: form.hasDispute,
          possessionStatus: form.possessionStatus,
        },
        media: form.media,
      };
      if (!form.lat || !form.lng)
        throw new Error("Set the property location before submitting.");
      let id = draftId;
      if (id) await api.patch(`/properties/${id}`, payload);
      else {
        id = (await api.post("/properties", payload)).data._id;
        setDraftId(id);
      }
      for (const asset of photos) {
        const prepared = await prepareUpload(asset, false),
          body = new FormData();
        body.append("uploadId", uploadKey(asset.uri));
        if (Platform.OS === "web")
          body.append("file", prepared.file, prepared.name);
        else body.append("file", prepared.file as any);
        const result = await api.post(`/properties/${id}/photos`, body, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        });
        setForm((f: any) => ({
          ...f,
          media: { ...f.media, photos: [...f.media.photos, result.data.url] },
        }));
        setPhotos((current) => current.filter((a) => a.uri !== asset.uri));
      }
      for (const document of documents) {
        const { asset, type } = document;
        const prepared = await prepareUpload(asset, true),
          body = new FormData();
        body.append("uploadId", uploadKey(`${type}:${asset.uri}`));
        body.append("propertyId", id);
        body.append("type", type);
        if (Platform.OS === "web")
          body.append("file", prepared.file, prepared.name);
        else body.append("file", prepared.file as any);
        await api.post("/documents", body, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 120000,
        });
        setDocuments(current => current.filter(item => item !== document));
      }
      await api.post(`/properties/${id}/submit`, { consent: true });
      setDone(true);
    });
  return (
    <MarketplaceShell
      title="Post property"
      subtitle={
        done
          ? "Your listing has been submitted"
          : `Step ${step} of 5 · Private until verified`
      }
      back
      showDock={false}
      step={step}
      footer={user && approved(user) && !done ? (
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
          onPress={() => (step === 5 ? submit() : setStep(step + 1))}
        />
      </View>
      ) : undefined}
      headerContent={user && approved(user) && !done ? (
        <View style={s.progress}>
          {["Basics", "Location", "Details", "Uploads", "Review"].map((label, index) => {
            const number = index + 1;
            const complete = number < step;
            const reached = number <= step;
            return (
              <React.Fragment key={label}>
                {index > 0 && <View style={[s.progressLine, reached && { backgroundColor: C.sun }]} />}
                <View style={s.progressStep} accessibilityLabel={complete ? `${label}, completed` : label} accessibilityState={{ selected: step === number }}>
                  <View style={[s.progressCircle, reached && s.progressReached]}>
                    {complete ? <Icon name="check" size={17} /> :
                      <Text style={[s.progressNumber, reached && { color: C.ink }]}>{number}</Text>}
                  </View>
                  <Text style={[s.progressLabel, reached && { color: C.sun }]}>{label}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>
      ) : undefined}
    >
      <Protected kyc>
        {done ? (
          <Empty
            title="Submitted for review"
            text="Your assigned Advisor or Verifier will review your property. Track updates in My Listings."
            action={
              <Button
                title="View my listings"
                onPress={() => router.replace("/my-properties")}
              />
            }
          />
        ) : (
          <>
            <ErrorBox text={action.error} />
            {step === 1 && (
              <>
              <PostSection number={1} title="What are you listing?">
                <View style={s.postPurpose} accessibilityLabel="Listing purpose">
                  <View accessible accessibilityLabel="Sell" accessibilityState={{ selected: true }}
                    style={[s.postPurposeOption, s.postPurposeSelected]}>
                    <Text style={s.postPurposeText}>Sell</Text>
                  </View>
                  <View accessible accessibilityLabel="Rent out, unavailable" accessibilityState={{ disabled: true }}
                    style={s.postPurposeOption}>
                    <Text style={s.postPurposeUnavailable}>Rent out</Text>
                    <Text style={s.small}>Unavailable</Text>
                  </View>
                </View>
                <View style={s.postTypeGrid}>
                  {[
                    { id: "flat", title: "Apartment", icon: "apartment" },
                    { id: "house", title: "House", icon: "home" },
                    { id: null, title: "Villa", icon: "park" },
                    { id: "land", title: "Plot", icon: "map" },
                    { id: "shop", title: "Commercial", icon: "people-outline" },
                    { id: null, title: "PG / Room", icon: "hotel" },
                  ].map(({ id, title, icon }) => {
                      const disabled = id === null;
                      const selected = !disabled && (form.type === id || (id === "shop" && form.type === "office"));
                      return <Pressable
                        key={title}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled}
                        style={[s.postTypeTile, selected && s.postTypeTileSelected]}
                        onPress={() => {
                          if (id && !selected) set("type")(id);
                        }}
                      >
                        <Icon name={icon} color={selected ? C.sun : disabled ? C.muted : C.ink} size={26} />
                        <Text style={[s.postTypeLabel, selected && { color: C.sun }, disabled && { color: C.muted }]}>{title}</Text>
                        {disabled && <Text style={s.small}>Unavailable</Text>}
                      </Pressable>;
                    })}
                </View>
                {["shop", "office"].includes(form.type) && (
                  <View style={s.wrap} accessibilityLabel="Commercial property type">
                    <Button title="Shop" secondary={form.type !== "shop"} onPress={() => set("type")("shop")} />
                    <Button title="Office" secondary={form.type !== "office"} onPress={() => set("type")("office")} />
                  </View>
                )}
              </PostSection>
              <PostSection number={2} title="Property details">
                <Field
                  title="Listing title"
                  uppercaseLabel
                  value={form.title}
                  onChangeText={set("title")}
                />
                <View style={s.row}>
                  <Field uppercaseLabel numeric title="Expected price (₹)" value={form.price} onChangeText={set("price")} />
                  <Field uppercaseLabel numeric title="Area (sq ft)" value={form.totalArea} onChangeText={set("totalArea")} />
                </View>
                {["flat", "house"].includes(form.type) && <>
                  {[["bedrooms", "Bedrooms"], ["bathrooms", "Bathrooms"]].map(([key, title]) => (
                    <View key={key} style={[s.between, s.postCounter]}>
                      <Text style={s.cardTitle}>{title}</Text>
                      <View style={s.row}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${key}`} disabled={!form[key]}
                          style={s.postCounterButton} onPress={() => set(key)(Math.max(0, Number(form[key]) - 1))}>
                          <Icon name="remove" size={18} />
                        </Pressable>
                        <Text style={s.postCounterValue}>{form[key] ?? "—"}</Text>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${key}`} disabled={form[key] >= 99}
                          style={[s.postCounterButton, s.postPurposeSelected]} onPress={() => set(key)(Math.min(99, (form[key] ?? 0) + 1))}>
                          <Icon name="add" color={C.sun} size={18} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  <Text style={[s.fieldLabel, s.postFieldLabel]}>Furnishing</Text>
                  <View style={s.wrap}>
                    {["Unfurnished", "Semi-furnished", "Fully furnished"].map(label => {
                      const value = label.toLowerCase();
                      const selected = form.furnishing === value;
                      return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }}
                        onPress={() => set("furnishing")(value)}
                        style={[s.typeChip, selected && s.postPurposeSelected]}>
                        <Text style={[s.cardTitle, selected && { color: C.sun }]}>{label}</Text>
                      </Pressable>;
                    })}
                  </View>
                </>}
                <Field
                  title="Description"
                  uppercaseLabel
                  value={form.description}
                  onChangeText={set("description")}
                  multiline
                />
              </PostSection>
              </>
            )}
            {step === 2 && (
              <>
                <PostSection number={3} title="Location">
                  <Text style={s.muted}>Add the property address and use the map to confirm its location.</Text>
                  <Field uppercaseLabel title="Society / street address" value={form.streetAddress || ""} onChangeText={set("streetAddress")} />
                  <View style={s.row}>
                    <Field uppercaseLabel title="Locality" value={form.block} onChangeText={set("block")} />
                    <Field uppercaseLabel numeric title="Pincode" value={form.pincode} onChangeText={set("pincode")} />
                  </View>
                  <View style={s.row}>
                    <Field uppercaseLabel title="State" value={form.state} onChangeText={set("state")} />
                    <Field uppercaseLabel title="City / district" value={form.district} onChangeText={set("district")} />
                  </View>
                </PostSection>
                <PostSection title="Map & boundary">
                  <Text style={s.muted}>Search for the property area or use GPS if you’re on site.</Text>
                  <Button secondary title="Use current location" icon="my-location" disabled={action.busy}
                    onPress={() => action.run(async () => {
                      const point = await currentMapLocation();
                      setPropertyLocation(point);
                      setParcelFocus({ ...point, zoom: 17 });
                    })}
                  />
                  <MapParcelPicker initialPoints={points} onParcelChange={onParcelChange} areaSqFt={form.totalArea}
                    locationFocus={parcelFocus} showLocate={false} onLocationSet={setPropertyLocation}
                    selectedLocation={selectedLocation} initialSearch={form.pincode || form.district || ""} />
                  {points.length > 0 && <Text style={s.small}>{points.length} {points.length === 1 ? "corner" : "corners"} marked</Text>}
                  <Pressable accessibilityRole="button" accessibilityState={{ expanded: showCoordinates }}
                    style={s.postCoordinates} onPress={() => setShowCoordinates(current => !current)}>
                    <Icon name="place" size={20} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.cardTitle}>GPS coordinates</Text>
                      <Text style={s.small}>{form.lat && form.lng ? "Location set · edit manually" : "Enter latitude and longitude manually"}</Text>
                    </View>
                    <Icon name={showCoordinates ? "expand-less" : "expand-more"} size={20} />
                  </Pressable>
                  {showCoordinates && (
                    <View style={s.row}>
                      <Field uppercaseLabel title="Latitude" value={form.lat} onChangeText={set("lat")} numeric />
                      <Field uppercaseLabel title="Longitude" value={form.lng} onChangeText={set("lng")} numeric />
                    </View>
                  )}
                  <Field uppercaseLabel title="Boundary notes (optional)" value={form.boundary} onChangeText={set("boundary")} multiline />
                  <Field uppercaseLabel title="Road width (ft)" value={form.roadWidth} onChangeText={set("roadWidth")} numeric />
                </PostSection>
              </>
            )}
            {step === 3 && (
              <PostSection title="Additional details">
                <Field uppercaseLabel numeric title="Sellable area (sq ft)" value={form.sellableArea} onChangeText={set("sellableArea")} />
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
                <Field
                  uppercaseLabel
                  title="Possession status"
                  value={form.possessionStatus}
                  onChangeText={set("possessionStatus")}
                />
              </PostSection>
            )}
            {step === 4 && (
              <>
                <PostSection number={4} title="Photos">
                  <View style={s.postTypeGrid}>
                    <Pressable accessibilityRole="button" accessibilityLabel="Add photo"
                      style={[s.postMediaTile, s.postMediaAdd]} disabled={action.busy || form.media.photos.length + photos.length >= 10}
                      onPress={() => action.run(() => pick())}>
                      <Icon name="photo-camera" size={26} />
                      <Text style={s.cardTitle}>Add photo</Text>
                    </Pressable>
                    {form.media.photos.map((uri: string, index: number) => (
                      <View key={uri} style={s.postMediaTile}>
                        <PropertyImage source={{ uri }} style={StyleSheet.absoluteFill} />
                        {index === 0 && <Text style={s.postCover}>Cover</Text>}
                      </View>
                    ))}
                    {photos.map((photo, index) => (
                      <View key={photo.uri} style={s.postMediaTile}>
                        <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} />
                        {index === 0 && !form.media.photos.length && <Text style={s.postCover}>Cover</Text>}
                        <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${photo.name}`}
                          disabled={action.busy} style={s.postPhotoRemove}
                          onPress={() => setPhotos(current => current.filter(item => item.uri !== photo.uri))}>
                          <Icon name="close" color="white" size={18} />
                        </Pressable>
                      </View>
                    ))}
                  </View>
                  <Text style={s.muted}>Add at least one property photo. The first photo is the cover.</Text>
                </PostSection>
                <PostSection number={5} title="Documents">
                  {postDocumentOptions.map(({ type, title, subtitle }) => {
                    const selected = documents.filter(document => document.type === type);
                    return (
                      <View key={type} style={[s.row, s.postCounter]}>
                        <View style={s.postDocumentIcon}><Icon name="description" size={22} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.cardTitle}>{title}</Text>
                          {selected.length ? selected.map(({ asset }) => (
                            <Text key={asset.uri} style={s.small}>
                              {asset.name}{asset.size != null ? ` · ${(asset.size / 1048576).toFixed(2)} MB` : ""}
                            </Text>
                          )) : <Text style={s.muted}>{subtitle}</Text>}
                          {selected.length > 0 && <Text style={[s.small, { color: C.green }]}>Ready to upload</Text>}
                        </View>
                        <Button title={selected.length ? "Replace" : "Upload"} disabled={action.busy} onPress={() => action.run(() => pick(type))} />
                      </View>
                    );
                  })}
                  <View style={s.row}>
                    <Icon name="lock-outline" color={C.muted} size={18} />
                    <Text style={[s.muted, { flex: 1 }]}>Ownership documents are private and used for verification.</Text>
                  </View>
                </PostSection>
              </>
            )}
            {step === 5 && (
              <PostSection title="Review & submit">
                <Field
                  uppercaseLabel
                  title="Advisor ID (optional)"
                  value={form.requestedAdvisorId}
                  onChangeText={set("requestedAdvisorId")}
                />
                <Text style={s.muted}>
                  Enter the ID provided by your Advisor. Leave it blank to
                  assign an eligible Verifier. This person handles verification,
                  offers, chats and closure.
                </Text>
                <Text style={s.cardTitle}>{form.title || `${form.type} in ${form.district || ""}`}</Text>
                <Text style={s.price}>{money(Number(form.price))}</Text>
                {points.length >= 3 && (
                  <Text style={[s.small, { color: C.green, fontWeight: "600", marginTop: 4 }]}>
                    ✓ Boundary demarcated with {points.length} map points
                  </Text>
                )}
                {!!form.boundary && (
                  <Text style={[s.small, { color: C.muted, marginTop: 2 }]}>
                    Boundary: {form.boundary}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: consent }}
                  style={s.row}
                  onPress={() => setConsent(!consent)}
                >
                  <Icon
                    name={consent ? "check-box" : "check-box-outline-blank"}
                  />
                  <Text style={[s.body, { flex: 1 }]}>
                    I am authorized to list this property and confirm that its
                    details and disclosures are accurate.
                  </Text>
                </Pressable>
              </PostSection>
            )}
            {Boolean(draftId) && (
              <Text style={s.small}>
                Draft saved: {draftId}. Uploads are retained if submission needs
                to be retried.
              </Text>
            )}
          </>
        )}
      </Protected>
    </MarketplaceShell>
  );
}
const font = "Manrope";
const fontDisplay = "Fraunces";
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroInner: { width: "100%", maxWidth: 1140, alignSelf: "center", gap: 18 },
  heroIcon: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center",
    justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
  },
  logo: { fontFamily: fontDisplay, fontSize: 25, color: "#fff", letterSpacing: -0.5 },
  logoIcon: { backgroundColor: C.sun, padding: 8, borderRadius: 12 },
  scroll: { paddingBottom: 108 },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: 20, gap: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  h1: {
    fontFamily: fontDisplay,
    fontSize: 28,
    lineHeight: 34,
    color: C.ink,
    letterSpacing: -0.4,
    textShadowColor: "rgba(255, 255, 255, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  h2: {
    fontFamily: fontDisplay,
    fontSize: 22,
    lineHeight: 28,
    color: C.ink,
    letterSpacing: -0.3,
    textShadowColor: "rgba(255, 255, 255, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  muted: { fontFamily: font, fontSize: 12.5, lineHeight: 18, color: C.muted, fontWeight: "500" },
  small: { fontFamily: font, fontSize: 11.5, lineHeight: 16, color: "#536174", fontWeight: "600" },
  body: { fontFamily: font, fontSize: 13.5, lineHeight: 21, color: C.ink, fontWeight: "500" },
  fieldLabel: {
    fontFamily: font,
    fontSize: 12,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: 0.1,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 22,
    backgroundColor: C.sun,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 2,
  },
  secondary: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(20, 38, 62, 0.18)",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontFamily: "ManropeExtraBold",
    fontSize: 14,
    color: C.ink,
    letterSpacing: 0.1,
  },
  input: {
    fontFamily: font,
    minHeight: 50,
    borderWidth: 1,
    borderColor: "rgba(20, 38, 62, 0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    fontSize: 13.5,
    color: C.ink,
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  hero: {
    paddingHorizontal: 20, paddingBottom: 24, backgroundColor: C.ink,
    borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden",
  },
  heroSun: {
    position: "absolute", width: 178, height: 178, borderRadius: 89,
    right: -52, top: -58, backgroundColor: C.sun,
  },
  heroRay: {
    position: "absolute", width: 74, height: 210, borderRadius: 40,
    right: 62, top: 70, backgroundColor: "#1C3556", transform: [{ rotate: "-30deg" }],
  },
  heroTitle: { fontFamily: fontDisplay, fontSize: 32, lineHeight: 38, color: "#fff" },
  heroSubtitle: { fontFamily: font, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.78)" },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.14)",
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  tagText: { fontFamily: font, fontSize: 11, fontWeight: "700", color: C.blue, letterSpacing: 0.1 },
  typeChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(20, 38, 62, 0.12)",
    borderRadius: 20,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  panel: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(20, 38, 62, 0.08)",
    backgroundColor: "#fff",
    gap: 12,
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "rgba(20, 38, 62, 0.08)",
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  photo: { height: 180, backgroundColor: "#EEE8D9" },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEE8D9",
  },
  imageTags: { position: "absolute", top: 10, left: 10 },
  cardBody: { padding: 14, gap: 6 },
  price: { fontFamily: font, fontSize: 19, lineHeight: 23, fontWeight: "800", color: C.ink, letterSpacing: -0.4 },
  cardTitle: {
    fontFamily: "ManropeBold",
    fontSize: 14.5,
    lineHeight: 20,
    color: C.ink,
    letterSpacing: -0.2,
  },
  link: { fontSize: 12.5, fontWeight: "700", color: C.blue },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.sunSoft,
    borderWidth: 1,
    borderColor: "rgba(26, 86, 219, 0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: C.blue, fontSize: 14 },
  dockWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 8,
    alignItems: "center",
    paddingHorizontal: 12,
    zIndex: 100,
  },
  nav: {
    width: "100%",
    maxWidth: 406,
    minHeight: 52,
    height: 70,
    borderRadius: 32,
    backgroundColor: C.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 10,
  },
  navItem: {
    flex: 1,
    maxWidth: 90,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 4,
    borderRadius: 18,
  },
  navGlyph: { width: 48, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  navText: { fontFamily: "ManropeBold", fontSize: 10.5, color: "#C7A532" },
  postCircle: {
    height: 58,
    width: 58,
    borderRadius: 29,
    marginTop: -36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.sun,
    borderWidth: 5,
    borderColor: C.bg,
    shadowColor: "#14263E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 8,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.10)",
  },
  error: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#fff0f2",
    color: "#a8193c",
    fontSize: 12.5,
    borderWidth: 1,
    borderColor: "rgba(225, 29, 72, 0.20)",
    fontWeight: "600",
  },
  map: {
    height: 380,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.14)",
  },
  spec: {
    minWidth: 130,
    flex: 1,
    padding: 12,
    backgroundColor: "rgba(244, 248, 255, 0.95)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.10)",
    gap: 4,
  },
  kycSummary: { backgroundColor: C.sunSoft },
  featureIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.sun, alignItems: "center", justifyContent: "center" },
  uploadTarget: { alignItems: "center", justifyContent: "center", gap: 8, padding: 22, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: C.line, backgroundColor: C.bg },
  documentRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, backgroundColor: C.bg, borderRadius: 12 },
  photoCounter: { position: "absolute", right: 12, bottom: 12, color: "#fff", backgroundColor: C.ink, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, fontFamily: "ManropeBold" },
  galleryThumb: { width: 82, height: 62, borderRadius: 14, borderWidth: 2, borderColor: C.line, overflow: "hidden" },
  gallerySave: { position: "absolute", top: 12, right: 12, width: 42, height: 42, borderRadius: 21 },
  chatArea: { gap: 14, minHeight: 240 },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 16, gap: 5 },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: C.sunSoft,
    borderWidth: 1,
    borderColor: "rgba(20, 38, 62, 0.18)",
    borderBottomRightRadius: 4,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(196, 211, 240, 0.85)",
    borderBottomLeftRadius: 4,
    shadowColor: "#061c46",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.blue },
  history: {
    padding: 10,
    borderLeftWidth: 3,
    borderColor: C.blue,
    gap: 3,
  },
  progress: { flexDirection: "row", justifyContent: "center", gap: 4 },
  progressStep: { width: 48, alignItems: "center", gap: 6 },
  progressLine: { height: 3, flex: 1, maxWidth: 64, marginTop: 18, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)" },
  progressCircle: {
    height: 36, width: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  progressReached: { backgroundColor: C.sun, borderColor: C.sun },
  progressNumber: { fontFamily: "ManropeExtraBold", color: "#fff" },
  progressLabel: { fontFamily: "ManropeBold", fontSize: 11, color: "rgba(255,255,255,0.76)", textAlign: "center" },
  postSection: { padding: 18, borderRadius: 22, gap: 16 },
  postSectionNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.sun, alignItems: "center", justifyContent: "center" },
  postSectionNumberText: { color: C.ink, fontFamily: "ManropeExtraBold", fontSize: 14 },
  postPurpose: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 16, backgroundColor: C.bg },
  postPurposeOption: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 4 },
  postPurposeSelected: { backgroundColor: C.ink },
  postPurposeText: { color: C.sun, fontFamily: "ManropeExtraBold", fontSize: 14 },
  postPurposeUnavailable: { color: C.muted, fontFamily: "ManropeBold", fontSize: 14 },
  postTypeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  postTypeTile: { width: "31%", minHeight: 86, borderRadius: 16, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", padding: 5, gap: 6, overflow: "hidden" },
  postTypeTileSelected: { backgroundColor: C.ink, borderColor: C.ink },
  postTypeLabel: { color: C.ink, fontFamily: "ManropeBold", fontSize: 13, textAlign: "center" },
  postFieldLabel: { textTransform: "uppercase", letterSpacing: 0.6, color: C.muted, fontFamily: "ManropeExtraBold" },
  postCoordinates: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, backgroundColor: C.bg, borderRadius: 14 },
  postCounter: { backgroundColor: C.bg, borderRadius: 16, padding: 12 },
  postCounterButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  postCounterValue: { minWidth: 22, textAlign: "center", color: C.ink, fontFamily: "ManropeExtraBold", fontSize: 16 },
  postMediaTile: { width: "31%", aspectRatio: 1, borderRadius: 16, overflow: "hidden", backgroundColor: C.bg },
  postMediaAdd: { borderWidth: 2, borderStyle: "dashed", borderColor: C.line, backgroundColor: "#FFF7DA", alignItems: "center", justifyContent: "center", gap: 6 },
  postCover: { position: "absolute", left: 5, top: 5, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: C.sun, color: C.ink, fontFamily: "ManropeExtraBold", fontSize: 11 },
  postPhotoRemove: { position: "absolute", right: 4, top: 4, height: 28, width: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: C.ink },
  postDocumentIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  footer: { backgroundColor: "#fff", borderTopWidth: 1, borderColor: C.line, paddingHorizontal: 20, paddingTop: 12 },
  profileHero: { paddingBottom: 82 },
  profileContent: { marginTop: -50 },
  profileEdit: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.ink },
  profileIdentity: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 8 },
  profilePortrait: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: C.sun, alignItems: "center", justifyContent: "center", backgroundColor: "#244268" },
  profileInitials: { color: "#fff", fontFamily: fontDisplay, fontSize: 28 },
  profileDetails: { flex: 1, gap: 3, alignItems: "flex-start" },
  profileName: { color: "#fff", fontFamily: fontDisplay, fontSize: 28, lineHeight: 34 },
  profileVerification: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7, backgroundColor: "#fff", paddingVertical: 6, paddingHorizontal: 11, borderRadius: 22, maxWidth: "100%" },
  profileStats: { flexDirection: "row", paddingVertical: 16, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: C.line, shadowColor: C.ink, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 3 },
  profileStat: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 52, gap: 2 },
  profileDivider: { borderLeftWidth: 1, borderColor: C.line },
  profileStatValue: { color: C.ink, fontSize: 23, fontFamily: "ManropeExtraBold" },
  profileMenu: { backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: C.line, overflow: "hidden", shadowColor: C.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  profileMenuTitle: { fontFamily: "ManropeExtraBold", fontSize: 16, color: C.ink, marginBottom: 2 },
  preferenceRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  preferenceSeparator: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: C.line },
  preferenceDetails: { paddingHorizontal: 14, paddingBottom: 14 },
  preferenceIcon: { height: 44, width: 44, borderRadius: 16, backgroundColor: C.sun, alignItems: "center", justifyContent: "center" },
  profileBadge: { minWidth: 29, minHeight: 29, borderRadius: 16, backgroundColor: C.ink, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  profileBadgeText: { color: C.sun, fontFamily: "ManropeExtraBold", fontSize: 12 },
  profileKycBadge: { backgroundColor: C.sunSoft },
  profileChevron: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: C.bg },
  stat: { flex: 1, minHeight: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  listingPhoto: { width: 96, height: 104, borderRadius: 16, backgroundColor: C.bg },
});
