import { AccountHeaderBackdrop, accountHeaderStyle } from "./AccountHeaderBackdrop";
import { BrandLockup, brandHeader } from "./BrandLockup";
import { randomUUID } from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { isRunningInExpoGo } from "expo";
import React, { useCallback, useEffect, useState, useRef } from "react";
import {
  Linking,
  KeyboardAvoidingView,
  ActivityIndicator,
  BackHandler,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
  useWindowDimensions,
} from "react-native";
import {
  useFocusEffect,
  useIsFocused,
  useLocalSearchParams,
  usePathname,
  useRouter,
  useSegments,
} from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import AccountArtworkFooter from "./AccountArtworkFooter";
import Svg, { Rect } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";
import { currentMapLocation, LocationPermissionBlocked } from "../src/services/currentMapLocation";
import { validMapPoint, type MapFocus, type MapPoint } from "../src/utils/nativeMapHtml";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { authService } from "../src/services/authService";
import { homeFeedBusyMessage, loadHomeRecommendations } from "../src/services/homeRecommendations";
import { useAuthStore } from "../src/store/authStore";
import { useLanguageStore } from "../src/store/languageStore";
import NotificationBell from "./NotificationBell";
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
  danger = false,
  disabled = false,
  icon,
}: any) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={[s.button, secondary && s.secondary, danger && s.dangerButton, disabled && { opacity: 0.5 }]}
    >
      {icon && <Icon name={icon} size={17} color={danger ? "#A52239" : undefined} />}
      <Text style={[s.buttonText, secondary && { color: C.blue }, danger && s.dangerButtonText]}>
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
  icon = "real-estate-agent",
  action,
}: any) {
  return (
    <View style={[s.panel, { alignItems: "center", padding: 32 }]}>
      <Icon name={icon} size={40} />
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
let searchRetryAt = 0;
const searchBusy = "Search is temporarily limited. Tap Retry search to try again.";
const isPropertySearch = (path: string | null) => Boolean(path?.startsWith("/properties/search?"));

async function waitForSearch(delay: number, signal?: AbortSignal) {
  if (signal?.aborted) throw new Error("Search canceled");
  if (delay <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const stop = () => { clearTimeout(timer); reject(new Error("Search canceled")); };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", stop);
      resolve();
    }, delay);
    signal?.addEventListener("abort", stop, { once: true });
  });
}

async function getData(path: string, signal?: AbortSignal) {
  if (!isPropertySearch(path)) return api.get(path);
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = searchRetryAt - Date.now();
    if (remaining > 60_000) break;
    await waitForSearch(remaining, signal);
    try {
      return await api.get(path, { signal });
    } catch (error: any) {
      if (error.response?.status !== 429) throw error;
      const headers = error.response.headers;
      const raw = String(headers?.["retry-after"] ?? "");
      const now = Date.now();
      const delay = /^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - now;
      searchRetryAt = Math.max(searchRetryAt, now + (Number.isFinite(delay) && delay > 0 ? delay : 15_000));
      console.warn("[Property search] Rate limited", {
        requestId: headers?.["x-request-id"], edgeRequestId: headers?.["x-hcdn-request-id"],
        server: headers?.server, retryAfter: headers?.["retry-after"],
      });
    }
  }
  throw new Error(searchBusy);
}

function useData(path: string | null, deps: any[] = [], homeScope?: string, keepLoadedPages = false) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    [nextCursor, setNextCursor] = useState<string | null>(null);
  const requestKey = JSON.stringify([path, deps, homeScope]);
  const latestRequest = useRef(requestKey);
  const refreshSequence = useRef(0);
  const loadedPagesKey = useRef<string | null>(null);
  const pagingRequest = useRef<{ key: string; signal?: AbortSignal } | null>(null);
  const searchScope = useRef<AbortController | null>(null);
  const searchRefresh = useRef<AbortSignal | null>(null);
  useEffect(() => { latestRequest.current = requestKey; }, [requestKey]);
  const [resultKey, setResultKey] = useState(requestKey);
  const refresh = useCallback(async (forceHomeRefresh = false) => {
    const [path, , homeScope] = JSON.parse(requestKey);
    if (!path) return;
    const signal = isPropertySearch(path) ? searchScope.current?.signal : undefined;
    if (signal && (searchRefresh.current === signal || pagingRequest.current?.signal === signal)) return;
    if (signal) searchRefresh.current = signal;
    const sequence = ++refreshSequence.current;
    setLoading(true);
    if (!path.startsWith("/inquiries")) setError("");
    try {
      const response = homeScope ? await loadHomeRecommendations(path, homeScope, forceHomeRefresh) : await getData(path, signal);
      if (signal?.aborted || latestRequest.current !== requestKey || sequence !== refreshSequence.current) return;
      setError("");
      setResultKey(requestKey);
      if (keepLoadedPages && loadedPagesKey.current === requestKey) {
        setData((previous: any[]) => {
          const fresh: any[] = response.data;
          const ids = new Set(fresh.map(item => item._id));
          return [...fresh, ...(previous || []).filter(item => !ids.has(item._id))];
        });
      } else {
        setData(response.data);
        setNextCursor(response.headers["x-next-cursor"] || null);
      }
    } catch (e) {
      if (!signal?.aborted && latestRequest.current === requestKey && sequence === refreshSequence.current) setError(errorText(e));
    } finally {
      if (signal && searchRefresh.current === signal) searchRefresh.current = null;
      if (latestRequest.current === requestKey && sequence === refreshSequence.current) setLoading(false);
    }
  }, [requestKey, keepLoadedPages]);
  useFocusEffect(
    useCallback(() => {
      const scope = isPropertySearch(path) ? new AbortController() : null;
      searchScope.current = scope;
      void refresh();
      return () => scope?.abort();
    }, [path, refresh]),
  );

  const loadPages = async (all: boolean) => {
    const signal = isPropertySearch(path) ? searchScope.current?.signal : undefined;
    if (!path || !nextCursor || loading || resultKey !== requestKey ||
        (pagingRequest.current?.key === requestKey && !pagingRequest.current.signal?.aborted)) return;
    const request = { key: requestKey, signal };
    pagingRequest.current = request;
    setLoading(true);
    setError("");
    try {
      let cursor: string | null = nextCursor;
      const items = new Map<string, any>(data.map((item: any) => [item._id, item]));
      const visited = new Set<string>();
      while (cursor && !visited.has(cursor)) {
        visited.add(cursor);
        const pagePath: string = path + (path.includes("?") ? "&" : "?") + "cursor=" + encodeURIComponent(cursor);
        if (signal && visited.size > 1) await waitForSearch(300, signal);
        const response = await getData(pagePath, signal);
        if (signal?.aborted || latestRequest.current !== requestKey) return;
        for (const item of response.data) items.set(item._id, item);
        cursor = response.headers["x-next-cursor"] || null;
        if (path.startsWith("/properties/search?")) {
          setData([...items.values()]);
          setNextCursor(cursor);
        }
        if (!all) break;
      }
      if (keepLoadedPages) {
        loadedPagesKey.current = requestKey;
        setData((current: any[]) => {
          const merged = new Map(items);
          for (const item of current || []) merged.set(item._id, item);
          return [...merged.values()].sort((a, b) =>
            Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));
        });
      } else setData([...items.values()]);
      setNextCursor(cursor);
    } catch (e) {
      if (!signal?.aborted && latestRequest.current === requestKey) setError(errorText(e));
    } finally {
      if (pagingRequest.current === request) pagingRequest.current = null;
      if (!signal?.aborted && latestRequest.current === requestKey) setLoading(false);
    }
  };
  return {
    data: resultKey === requestKey ? data : null, error, loading, refresh, setData, nextCursor,
    loadMore: () => loadPages(false), loadAll: () => loadPages(true)
  };
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
const dockHeight = 70;

export function MarketplaceShell({
  title,
  subtitle,
  compactHeader = false,
  children,
  back = false,
  onBack,
  headerContent,
  headerAction,
  heroIllustration,
  listBody = false,
  backgroundArtwork,
  fixedHeader,
  transcriptRef,
  transcriptEvents,
  showDock = true,
  footer,
  footerStyle,
  profileHeader,
  scrollFooter,
  dockArtwork = false,
  scrollEnabled = true,
  refreshControl,
  step,
}: {
  title?: React.ReactNode;
  subtitle?: string;
  compactHeader?: boolean;
  children: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
  headerContent?: React.ReactNode;
  headerAction?: React.ReactNode;
  heroIllustration?: React.ReactNode;
  listBody?: boolean;
  backgroundArtwork?: React.ReactNode;
  fixedHeader?: React.ReactNode;
  transcriptRef?: React.RefObject<ScrollViewInstance | null>;
  transcriptEvents?: Pick<ScrollViewProps, "onLayout" | "onScroll" | "onScrollBeginDrag" | "onContentSizeChange">;
  showDock?: boolean;
  footer?: React.ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  profileHeader?: React.ReactElement;
  scrollFooter?: (dockClearance: number) => React.ReactElement;
  dockArtwork?: boolean;
  scrollEnabled?: boolean;
  refreshControl?: ScrollViewProps["refreshControl"];
  step?: number;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const smallHeader = compactHeader && (width < 370 || height - insets.top - insets.bottom < 620);
  const dockBottom = Math.max(insets.bottom, 8);
  const dockClearance = dockBottom - insets.bottom + dockHeight;
  const router = useRouter(),
    path = usePathname(),
    user = useAuthStore((x) => x.user);
  const focused = useIsFocused();
  const [routeGroup] = useSegments();
  const contextualTab =
    path === "/saved" ? ["/saved", "favorite-border", "Wishlist"] :
      path === "/my-properties" ? ["/my-properties", "apartment", "Listings"] :
        path.startsWith("/deal/") ? [path, "handshake", "Deal"] :
          ["/messages", "chat-bubble-outline", "Chats"];
  const scroll = useRef<ScrollViewInstance>(null);
  useEffect(() => {
    if (step !== undefined) scroll.current?.scrollTo({ y: 0, animated: false });
  }, [step]);
  const isProfile = path === "/profile" || Boolean(profileHeader);
  const hero = !fixedHeader && (
    <View style={[s.hero, { paddingTop: insets.top + (smallHeader ? 8 : 14) }, compactHeader && s.compactHero,
      smallHeader && s.smallHero, isProfile && !profileHeader && s.guestProfileHero, profileHeader && s.profileHero]}>
      {isProfile ? <AccountHeaderBackdrop top={insets.top + 4} /> : (
        <>
          <View pointerEvents="none" style={s.heroSun} />
          <View pointerEvents="none" style={s.heroRay} />
        </>
      )}
      <View style={[s.heroInner, compactHeader && s.compactHeroInner]}>
        {profileHeader || <>
          <View style={[s.heroBrandGroup, (isProfile || path === "/saved") && s.spacedBrandGroup]}>
            <View style={[s.header, Boolean(user) && width < 390 && { gap: 6 }]}>
              <View style={[s.row, { flex: 1, minWidth: 0 }]}>
                {back ? (
                  <Pressable
                    accessibilityLabel="Back"
                    accessibilityRole="button"
                    style={s.heroIcon}
                    onPress={onBack ?? (() =>
                      router.canGoBack() ? router.back() : router.replace("/home")
                    )}
                  >
                    <Icon name="arrow-back" color="white" size={20} />
                  </Pressable>
                ) : null}
                <Pressable style={[s.row, { flexShrink: 1, minWidth: 0, gap: 6 }]} onPress={() => router.push("/home")}>
                  <BrandLockup />
                </Pressable>
              </View>
              {headerAction ?? (
                <Pressable
                  accessibilityLabel="Wishlist"
                  accessibilityRole="button"
                  style={s.heroIcon}
                  onPress={() => router.push("/saved")}
                >
                  <Icon name="favorite-border" color="white" size={20} />
                </Pressable>
              )}
              <NotificationBell />
            </View>
            {Boolean(title) && (
              <View style={[heroIllustration ? s.illustratedHeroTitle : undefined, isProfile && accountHeaderStyle.titleGroup]}>
                <View style={heroIllustration ? { flex: 1, minWidth: 0, gap: 2 } : { gap: 4 }}>
                  <Text accessibilityRole="header" style={[s.heroTitle, isProfile && accountHeaderStyle.heading]}>{title}</Text>
                  {Boolean(subtitle) && <Text numberOfLines={compactHeader || heroIllustration ? 1 : undefined}
                  adjustsFontSizeToFit={compactHeader || Boolean(heroIllustration)} minimumFontScale={heroIllustration ? 0.9 : 0.85}
                  style={[s.heroSubtitle, (smallHeader || Boolean(heroIllustration)) && s.smallHeroSubtitle]}>{subtitle}</Text>}
                </View>
                {heroIllustration}
              </View>
            )}
          </View>
          {headerContent}
        </>}
      </View>
    </View>
  );
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {focused && <StatusBar style="light" />}
      {fixedHeader}
      <View style={s.scrollViewport}>
        {backgroundArtwork}
        {listBody ? <>
          {hero}
          <View style={{ flex: 1, paddingBottom: showDock ? dockBottom + dockHeight + 12 : 0 }}>{children}</View>
        </> : <ScrollView
          ref={transcriptRef ?? scroll}
          {...transcriptEvents}
          scrollEventThrottle={transcriptEvents ? 16 : undefined}
          scrollEnabled={scrollEnabled}
          refreshControl={refreshControl}
          style={{ flex: 1 }}
          contentContainerStyle={[s.scroll, !showDock && { paddingBottom: 12 }, scrollFooter && s.scrollWithArtwork,
          !scrollEnabled && scrollFooter && s.fitArtworkToViewport,
          !scrollEnabled && scrollFooter && showDock && !dockArtwork && { paddingBottom: dockBottom + dockHeight + 16 },
          showDock && dockArtwork && { paddingBottom: dockBottom + dockHeight + 54 }]}
          keyboardShouldPersistTaps="handled"
        >
          {hero}
          <View style={[s.content, profileHeader && s.profileContent]}>
            {children}
          </View>
          {scrollFooter?.(showDock ? dockClearance : 0)}
        </ScrollView>}
      </View>
      {footer && <View style={[s.footer, footerStyle, { paddingBottom: Math.max(insets.bottom, 12) }]}>{footer}</View>}
      {showDock && dockArtwork && <View pointerEvents="none" style={s.dockArtwork}>
        <AccountArtworkFooter wavesOnly bottomExtension={dockClearance} hideWhileTyping={false} />
      </View>}
      {showDock && <View
        style={[s.dockWrapper, { bottom: dockBottom, pointerEvents: "box-none" }]}
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
                  if (isActive) return;
                  if (url === "/post") {
                    router.push("/post");
                    return;
                  }
                  if (routeGroup === "(tabs)" || Platform.OS === "web") {
                    router.navigate(url as any);
                    return;
                  }
                  router.dismissTo(url as any);
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
function Protected({ children, kyc = false, guest }: {
  children: React.ReactNode;
  kyc?: boolean;
  guest?: { title: string; text: string; icon: keyof typeof MaterialIcons.glyphMap };
}) {
  const user = useAuthStore((x) => x.user),
    gate = useGate();
  if (!user || (kyc && !approved(user)))
    return (
      <Empty
        icon={!user ? guest?.icon : undefined}
        title={
          !user
            ? guest?.title ?? "Your next step starts here"
            : "Complete identity verification"
        }
        text={
          !user
            ? guest?.text ?? "Browse freely. Sign in to save properties and manage your account."
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
          <PropertyImage
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
                      .catch(() => { });
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
    [storedPrefs, setStoredPrefs] = useState<{ scope: string; value: any }>();
  const scope = user?.id || "guest";
  const prefs = storedPrefs?.scope === scope ? storedPrefs.value : {};
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(`marketplace_preferences_${scope}`)
      .then(v => v ? JSON.parse(v) || {} : {})
      .catch(() => ({}))
      .then(value => { if (active) setStoredPrefs({ scope, value }); });
    return () => { active = false; };
  }, [scope]);
  const recent = useData("/recommendations?mode=new", [], "public"),
    trending = useData("/recommendations?mode=trending", [], "public"),
    personal = useData(
      storedPrefs?.scope === scope ? `/recommendations?mode=personalized&district=${encodeURIComponent(prefs.district || "")}&type=${type || prefs.type || ""}&maxPrice=${prefs.maxPrice || ""}` : null,
      [user?.id],
      scope,
    ),
    { width } = useWindowDimensions();
  const [refreshingHome, setRefreshingHome] = useState(false);
  const homeRefreshPending = useRef(false);
  const refreshHome = async () => {
    if (homeRefreshPending.current) return;
    homeRefreshPending.current = true;
    setRefreshingHome(true);
    try {
      await Promise.all([personal.refresh(true), recent.refresh(true), trending.refresh(true)]);
    } finally {
      homeRefreshPending.current = false;
      setRefreshingHome(false);
    }
  };
  const homeBusy = [personal, recent, trending].some(feed => feed.error === homeFeedBusyMessage);
  return (
    <MarketplaceShell
      title={<>Find your next home.{"\n"}<Text style={{ color: C.sun }}>Direct from owners.</Text></>}
      subtitle="Explore homes and plots by locality, property type, and budget."
      refreshControl={Platform.OS !== "web" ? (
        <RefreshControl refreshing={refreshingHome} onRefresh={() => void refreshHome()}
          tintColor={C.sun} colors={[C.ink]} progressBackgroundColor={C.sunSoft} />
      ) : undefined}
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
        {prefs.district ? (
          <Pressable accessibilityRole="button" style={s.homeDistrict}
            onPress={() => router.push({ pathname: "/search", params: { q: prefs.district } })}>
            <Icon name="location-on" size={17} color={C.ink} />
            <Text style={s.homeDistrictLabel}>Browse {prefs.district}</Text>
            <Icon name="arrow-forward" size={15} color={C.ink} />
          </Pressable>
        ) : null}
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
      {homeBusy && <View style={s.panel}>
        <Text accessibilityRole="alert" style={s.body}>{homeFeedBusyMessage}</Text>
        <Button title="Retry listings" secondary disabled={refreshingHome} onPress={() => void refreshHome()} />
      </View>}
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
            {feed.error === homeFeedBusyMessage && !listings.length ? null : (feed.loading || (feed === personal && storedPrefs?.scope !== scope)) && !listings.length ? (
              <ActivityIndicator color={C.blue} />
            ) : feed.error && !listings.length ? (
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
  const [nearby, setNearby] = useState<MapFocus>();
  const locationAction = useAction();
  const [locationPermissionBlocked, setLocationPermissionBlocked] = useState(false);
  const directionsAction = useAction();
  const nearbyQuery = nearby ? `&nearLat=${nearby.lat.toFixed(3)}&nearLng=${nearby.lng.toFixed(3)}` : "";
  const feed = useData(
    `/properties/search?limit=50&location=${encodeURIComponent(nearby ? "" : submitted)}${type ? "&type=" + type : ""}${max ? "&maxPrice=" + max : ""}${nearbyQuery}`,
  );
  const select = useCallback((p: any) => setSelected(p), []);
  const [mapGestureActive, setMapGestureActive] = useState(false);
  const [mapFitVersion, setMapFitVersion] = useState(0);
  const { height } = useWindowDimensions();
  const properties = feed.data || [];
  const visibleSelection = selected && properties.find((property: any) => property._id === selected._id);
  const hasMapSelection = Boolean(map && visibleSelection);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (hasMapSelection) {
        setSelected(null);
      } else if (filter) {
        setFilter(false);
      } else if (nearby) {
        setNearby(undefined);
        setSelected(null);
      } else if (!map) {
        setMap(true);
      }
      setMapGestureActive(false);
      // Search is a primary tab. Home is available from the bottom navigation.
      return true;
    });
    return () => subscription.remove();
  }, [filter, hasMapSelection, map, nearby]));
  useFocusEffect(useCallback(() => () => setSelected(null), []));
  const destination = visibleSelection?.location;
  const directionsUrl = validMapPoint(destination)
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${destination.lat},${destination.lng}`)}&dir_action=navigate`
    : null;
  const recordedSearch = useRef("");
  useEffect(() => {
    const activityKey = JSON.stringify([user?.id, submitted]);
    if (!user?.id || !submitted || !feed.data?.length || recordedSearch.current === activityKey) return;
    recordedSearch.current = activityKey;
    for (const property of feed.data.slice(0, 5))
      void api.post(`/recommendations/${property._id}/activity`, { kind: "search" }).catch(() => {});
  }, [feed.data, submitted, user?.id]);
  const search = () => {
    if (!nearby && query === submitted) {
      void feed.refresh();
      return;
    }
    setNearby(undefined);
    setSelected(null);
    setSubmitted(query);
    if (user)
      void api
        .post("/recommendations/preferences", {
          district: query,
          type,
          ...(max ? { maxPrice: Number(max) } : {}),
        })
        .catch(() => { });
    void AsyncStorage.setItem(
      `marketplace_preferences_${user?.id || "guest"}`,
      JSON.stringify({ district: query, type, maxPrice: max }),
    );
  };
  return (
    <MarketplaceShell
      title="Search properties"
      subtitle="Search by area or explore listings on the map."
      scrollEnabled={!mapGestureActive}
      headerContent={
        <View style={s.searchControls}>
          <View style={s.searchInputRow}>
            <TextInput
              accessibilityLabel="Search properties"
              value={query}
              onChangeText={setQuery}
              placeholder="Locality, project or city"
              placeholderTextColor="#6f82a8"
              onSubmitEditing={search}
              returnKeyType="search"
              style={s.searchInputText}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Search" onPress={search} style={s.searchSubmit}>
              <Icon name="search" size={21} />
            </Pressable>
          </View>
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
        <View style={[s.panel, s.searchFilterPanel]}>
          <View style={s.searchFilterHeader}>
            <View style={s.searchFilterIcon}><Icon name="tune" color={C.ink} size={20} /></View>
            <Text accessibilityRole="header" style={s.searchFilterTitle}>Refine your search</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close filters" onPress={() => setFilter(false)} style={s.searchFilterClose}>
              <Icon name="close" color={C.ink} size={20} />
            </Pressable>
          </View>
          <Field
            title="Maximum price (₹)"
            value={max}
            onChangeText={setMax}
            numeric
          />
          <Text style={s.fieldLabel}>Property type</Text>
          <View style={s.wrap}>
            {types.map(([id, text]) => (
              <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: type === id }}
                onPress={() => setType(id)} style={[s.searchFilterChip, type === id && s.searchFilterChipSelected]}>
                <Text style={[s.searchMapLoadingText, type === id && s.searchFilterChipTextSelected]}>{text}</Text>
              </Pressable>
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
      <View style={s.searchResultsControls}>
        <Button
          secondary
          title={map ? "List view" : "Map view"}
          icon={map ? "view-list" : "map"}
          onPress={() => { setMapGestureActive(false); setSelected(null); setMap(!map); }}
        />
        <Button title="Show all on map" icon="map" disabled={feed.loading || !properties.length}
          onPress={() => {
            setMapGestureActive(false);
            setSelected(null);
            setMap(true);
            if (!feed.nextCursor) setMapFitVersion(version => version + 1);
            void feed.loadAll();
          }} />
      </View>
      {nearby && <View style={s.searchResultsControls}>
        <Tag>Within 25 km of your location</Tag>
        <Button title="Clear nearby" secondary onPress={() => { setNearby(undefined); setSelected(null); }} />
      </View>}
      <ErrorBox text={feed.error} />
      {!!feed.error && <Button title="Retry search" secondary disabled={feed.loading} onPress={() => void feed.refresh()} />}
      <ErrorBox text={locationAction.error} />
      {locationPermissionBlocked && locationAction.error && <Button title="Open app settings" icon="settings" secondary
        onPress={() => void locationAction.run(() => Linking.openSettings())} />}
      {feed.loading && !map && <ActivityIndicator color={C.blue} />}
      {map && (
        <View style={[s.map, { height: Math.min(420, Math.max(260, height * 0.44)), zIndex: 0 }]}
          onTouchStart={event => { if (Platform.OS !== "web" && event.nativeEvent.touches.length === 2) setMapGestureActive(true); }}
          onTouchEnd={event => { if (Platform.OS !== "web" && event.nativeEvent.touches.length === 0) setMapGestureActive(false); }}
          onTouchCancel={() => setMapGestureActive(false)}>
          <VerifiedPropertyMap key={mapFitVersion} properties={properties} onSelect={select}
            focus={nearby} selectedId={visibleSelection ? visibleSelection.id || visibleSelection._id : null} zoomControls twoFingerPan />
          <Pressable accessibilityRole="button" accessibilityLabel="Find properties near my location"
            accessibilityState={{ disabled: locationAction.busy, busy: locationAction.busy }}
            disabled={locationAction.busy} style={s.searchMapLocation}
            onPress={() => void locationAction.run(async () => {
              setLocationPermissionBlocked(false);
              let point: MapPoint;
              try {
                point = await currentMapLocation({ allowRecent: true });
              } catch (error) {
                setLocationPermissionBlocked(error instanceof LocationPermissionBlocked);
                throw error;
              }
              setSelected(null);
              setNearby({ ...point, zoom: 9 });
            })}>
            {locationAction.busy ? <ActivityIndicator color={C.ink} /> : <Icon name="my-location" color={C.ink} />}
          </Pressable>
          {(locationAction.busy || feed.loading) && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.searchMapLoading]} accessibilityLiveRegion="polite">
              <View style={s.searchMapLoadingPill}>
                <ActivityIndicator color={C.ink} />
                <Text style={s.searchMapLoadingText}>{locationAction.busy ? "Finding your location…" : "Loading properties…"}</Text>
              </View>
            </View>
          )}
        </View>
      )}
      {visibleSelection && map && (
        <View style={s.panel}>
          <PropertyCard property={visibleSelection} compact />
          {directionsUrl && <Button title="Google Maps directions" icon="directions" disabled={directionsAction.busy}
            onPress={() => void directionsAction.run(async () => {
              await Linking.openURL(directionsUrl);
              setSelected(null);
            })} />}
          <ErrorBox text={directionsAction.error} />
          <Button
            secondary
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
  const router = useRouter();
  const goToChats = useCallback(() => router.navigate("/messages"), [router]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goToChats();
      return true;
    });
    return () => subscription.remove();
  }, [goToChats]));
  const user = useAuthStore((x) => x.user),
    feed = useData(user ? "/users/wishlist" : null, [user?.id]),
    [sort, setSort] = useState(false);
  const rows = [...(feed.data || [])];
  const showArtwork = !user || (!feed.loading && !feed.error && feed.data?.length === 0);
  const savedCount = `${rows.length}${feed.nextCursor ? "+" : ""}`;
  if (sort) rows.sort((a, b) => a.price - b.price);
  return (
    <MarketplaceShell
      title="Wishlist"
      dockArtwork
      scrollEnabled={rows.length > 0}
      scrollFooter={showArtwork ? () => (
        <View style={s.wishlistArtwork} pointerEvents="none">
          <View style={s.wishlistWatermarkFrame}>
            <Image source={require("../assets/images/wishlist_watermark.png")}
              style={s.watermarkImage} resizeMode="contain"
              accessible={Boolean(user)} accessibilityLabel={user ? "Your wishlist is empty" : undefined} />
          </View>
        </View>
      ) : undefined}
      subtitle="Keep a shortlist of properties to revisit."
      headerAction={false}
      headerContent={user ? (
        <View style={s.wishlistToolbar}>
          <View style={s.wishlistSummary}>
            <Icon name="favorite" size={16} color={C.sun} />
            <Text style={s.wishlistSummaryText}>
              {user && feed.data
                ? `${savedCount} saved ${rows.length === 1 && !feed.nextCursor ? "property" : "properties"}`
                : "Tap the heart on a listing to save it."}
            </Text>
          </View>
          {rows.length > 1 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sort ? "Show newest saved first" : "Sort by lowest price"}
              onPress={() => setSort(current => !current)}
              style={({ pressed }) => [s.wishlistSort, pressed && { opacity: 0.8 }]}
            >
              <Icon name="sort" size={17} />
              <Text style={s.wishlistSortText}>{sort ? "Newest saved" : "Sort by price"}</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate("/(tabs)/search")}
              style={({ pressed }) => [s.wishlistSort, s.wishlistBrowse, pressed && { opacity: 0.8 }]}
            >
              <Icon name="search" size={17} />
              <Text style={s.wishlistSortText}>Browse properties</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={s.wishlistGuestToolbar}>
          <Pressable accessibilityRole="button" onPress={() => router.navigate("/(tabs)/search")}
            style={({ pressed }) => [s.wishlistHeaderBrowse, pressed && { opacity: 0.8 }]}>
            <Icon name="search" size={18} />
            <Text style={s.wishlistSortText}>Browse properties</Text>
            <Icon name="arrow-forward" size={16} />
          </Pressable>
          <View style={s.wishlistSaveTip}>
            <Icon name="favorite-border" color={C.sun} size={17} />
            <Text style={s.wishlistSaveTipText}>Tap a heart to save a listing.</Text>
          </View>
        </View>
      )}
      back
      onBack={goToChats}
    >
      <Protected guest={{
        title: "Keep your favourites together",
        text: "Sign in, then tap the heart on any listing to add it to your Wishlist.",
        icon: "favorite-border",
      }}>
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
        <View style={s.profileHeaderCopy}>
          <Text accessibilityRole="header" style={[s.heroTitle, accountHeaderStyle.heading]}>Profile</Text>
          <Text numberOfLines={1} style={[s.heroSubtitle, s.profileHeroCaption]}>Your account and activity</Text>
        </View>
        <View style={s.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit profile"
            accessibilityState={{ expanded: editing }} onPress={openEditor} style={s.profileEdit}>
            <Icon name="edit" color={C.sun} />
          </Pressable>
          <NotificationBell />
        </View>
      </View>
      <View style={[s.profileIdentity, accountHeaderStyle.divider]}>
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
    <MarketplaceShell title="Profile" subtitle="Your saved homes and account settings." profileHeader={profileHeader}
      scrollFooter={!user ? bottomExtension => <AccountArtworkFooter bottomExtension={bottomExtension} /> : undefined}>
      {user ? (
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
            danger
            icon="logout"
            onPress={() =>
              action.run(async () => {
                await authService.logout();
                router.replace("/home");
              })
            }
          />
        </>
      ) : (
        <View style={[s.card, s.guestAccountCard]}>
          <View style={s.guestAccountHeading}>
            <Text accessibilityRole="header" style={s.guestAccountTitle}>Make yourself at home</Text>
            <View style={s.guestAccountIcon} accessible={false}>
              <Icon name="vpn-key" color={C.ink} size={22} />
            </View>
          </View>
          <Text style={s.guestAccountDescription}>Sign in to revisit saved listings and manage your enquiries.</Text>
          <Button title="Sign in / Register" onPress={() => router.push({ pathname: "/login", params: { returnTo: "/profile" } })} />
        </View>
      )}
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
        .catch(() => { });
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
              <PropertyImage
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
                    void api.post(`/recommendations/${id}/activity`, { kind: "save" }).catch(() => { });
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
                  <PropertyImage source={{ uri }} style={StyleSheet.absoluteFill} />
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
            <View style={s.map}><VerifiedPropertyMap properties={[p]} onSelect={() => { }} /></View>
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
  const [advisorStatus, setAdvisorStatus] = useState<{ loading: boolean; valid?: boolean; name?: string; message?: string }>({ loading: false });
  const canPost = user?.role === "user" && approved(user);

  useEffect(() => {
    if (!canPost) return;
    const raw = form.requestedAdvisorId?.trim();
    const timer = setTimeout(async () => {
      if (!raw) {
        setAdvisorStatus({ loading: false });
        return;
      }
      setAdvisorStatus({ loading: true });
      try {
        const res = await api.get(`/properties/advisor-lookup/${encodeURIComponent(raw)}`);
        if (res.data?.valid) {
          setAdvisorStatus({ loading: false, valid: true, name: res.data.advisor?.name });
        } else {
          setAdvisorStatus({ loading: false, valid: false, message: res.data?.message || "Advisor not found." });
        }
      } catch (err: any) {
        setAdvisorStatus({
          loading: false,
          valid: false,
          message: err?.response?.data?.message || "Advisor not found. Leave blank to auto-assign.",
        });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [canPost, form.requestedAdvisorId]);

  const onAdvisorIdChange = (text: string) => {
    let clean = text.trim().toUpperCase();
    if (/^[1-9][0-9]{5}$/.test(clean)) {
      clean = `ADV-${clean}`;
    } else if (/^ADV[1-9][0-9]{5}$/.test(clean)) {
      clean = `ADV-${clean.slice(3)}`;
    }
    setForm((f: any) => ({ ...f, requestedAdvisorId: clean }));
  };

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
    if (canPost && params.id && editorUserId)
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
  }, [canPost, params.id, editorUserId, runAction]);
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
      if (!canPost) throw new Error("A verified buyer/seller account is required to post property.");
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
        requestedAdvisorCode: form.requestedAdvisorId.trim(),
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
  if (user?.role === "advisor") {
    return (
      <MarketplaceShell
        title="Post property"
        subtitle="Review property details and track the status of your assigned listings."
        headerContent={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Advisor dashboard"
            onPress={() => router.push(dashboardRoutes.advisor)}
            style={({ pressed }) => [s.advisorPostShortcut, pressed && { opacity: 0.8 }]}
          >
            <View style={s.advisorPostIcon}>
              <Icon name="assignment" size={21} color={C.ink} />
            </View>
            <View style={s.advisorPostShortcutCopy}>
              <Text style={s.advisorPostShortcutTitle}>Assigned listings</Text>
              <Text style={s.advisorPostShortcutHint}>Open Advisor dashboard</Text>
            </View>
            <Icon name="arrow-forward" size={21} color={C.ink} />
          </Pressable>
        }
        back
        dockArtwork
        scrollFooter={() => (
          <View style={[s.postWatermarkFrame, s.advisorPostArtwork]} aria-hidden pointerEvents="none">
            <Image source={require("../assets/images/post_property_watermark.png")}
              style={s.watermarkImage} resizeMode="contain" accessible={false} />
          </View>
        )}
      >
        <View style={[s.card, s.advisorPostCard]}>
          <Text accessibilityRole="header" style={s.advisorPostTitle}>Who can post a property?</Text>
          <Text style={s.advisorPostDescription}>New listings are created by verified buyer or seller accounts.</Text>
        </View>
      </MarketplaceShell>
    );
  }
  if (user && user.role !== "user") {
    return (
      <MarketplaceShell title="Post property" back>
        <Empty
          title="Posting requires a buyer/seller account"
          text="Use a verified buyer/seller account to create a listing. Use your staff dashboard to manage assigned listings."
          action={<Button title="Staff dashboard" onPress={() => router.push(dashboardRoutes[user.role] as any)} />}
        />
      </MarketplaceShell>
    );
  }
  return (
    <MarketplaceShell
      title="Post property"
      subtitle={
        done
          ? "Your listing has been submitted"
          : canPost
            ? `Step ${step} of 5 · Private until verified`
            : "Create a listing for your property on MalikSe."
      }
      back={Boolean(user)}
      showDock={!canPost || done}
      scrollEnabled={canPost}
      scrollFooter={!canPost ? () => (
        <View style={s.postWatermarkFrame} aria-hidden pointerEvents="none">
          <Image source={require("../assets/images/post_property_watermark.png")}
            style={s.watermarkImage} resizeMode="contain" accessible={false} />
        </View>
      ) : undefined}
      step={step}
      footer={canPost && !done ? (
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
      headerContent={canPost && !done ? (
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
      <Protected kyc guest={{
        title: "Start your property listing",
        text: "Sign in or create an account to add your property details and submit your listing for verification.",
        icon: "real-estate-agent",
      }}>
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
                  title="Advisor ID (Optional)"
                  placeholder="e.g. ADV-482910"
                  value={form.requestedAdvisorId}
                  onChangeText={onAdvisorIdChange}
                />
                {advisorStatus.loading ? (
                  <View style={[s.row, { marginTop: 6, gap: 6 }]}>
                    <ActivityIndicator size="small" color={C.blue} />
                    <Text style={[s.small, { color: C.muted }]}>Verifying Advisor ID...</Text>
                  </View>
                ) : advisorStatus.valid ? (
                  <View style={[s.row, { marginTop: 6, padding: 10, backgroundColor: "#EBF7EE", borderRadius: 8, gap: 6 }]}>
                    <Icon name="check-circle" color={C.green} size={18} />
                    <Text style={[s.small, { color: C.green, fontWeight: "600", flex: 1 }]}>
                      ✓ Verified Advisor: {advisorStatus.name}
                    </Text>
                  </View>
                ) : form.requestedAdvisorId?.trim() ? (
                  <View style={[s.row, { marginTop: 6, padding: 10, backgroundColor: "#FDF4E7", borderRadius: 8, gap: 6 }]}>
                    <Icon name="error-outline" color="#B45309" size={18} />
                    <Text style={[s.small, { color: "#B45309", flex: 1 }]}>
                      {advisorStatus.message || "Advisor not found. Leave blank to auto-assign."}
                    </Text>
                  </View>
                ) : (
                  <View style={[s.row, { marginTop: 6, padding: 10, backgroundColor: "#F0F5FA", borderRadius: 8, gap: 6 }]}>
                    <Icon name="bolt" color={C.blue} size={18} />
                    <Text style={[s.small, { color: C.blue, flex: 1 }]}>
                      Auto-Assignment: Leave blank to automatically match with an active advisor covering {form.district || "your district"}.
                    </Text>
                  </View>
                )}
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
      {!canPost && (
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.h2}>What you’ll need</Text>
          {([
            ["place", "Property address and location"],
            ["photo-camera", "Clear photos and property details"],
            ["description", "Ownership documents for verification"],
          ] as const).map(([icon, text]) => (
            <View key={icon} style={s.row}>
              <View style={s.postPrepIcon}><Icon name={icon} size={19} color={C.ink} /></View>
              <Text style={[s.body, { flex: 1 }]}>{text}</Text>
            </View>
          ))}
        </View>
      )}
    </MarketplaceShell>
  );
}
const font = "Manrope";
const fontDisplay = "Fraunces";
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroInner: { width: "100%", maxWidth: 1140, alignSelf: "center", gap: brandHeader.gap },
  heroBrandGroup: { gap: brandHeader.gap },
  compactHeroInner: { gap: 10 },
  heroIcon: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center",
    justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.20)",
  },
  scroll: { paddingBottom: 108 },
  scrollWithArtwork: { flexGrow: 1, paddingBottom: 0 },
  fitArtworkToViewport: { flex: 1 },
  wishlistGuestToolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10 },
  wishlistHeaderBrowse: {
    minHeight: 44, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: C.sun,
  },
  wishlistSaveTip: { flexGrow: 1, flexBasis: 104, maxWidth: 158, flexDirection: "row", alignItems: "center", gap: 6 },
  wishlistSaveTipText: { flexShrink: 1, color: "#E7EDF5", fontFamily: font, fontSize: 12, lineHeight: 17 },
  wishlistToolbar: {
    flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
    gap: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#FFFFFF26",
  },
  wishlistSummary: { flexDirection: "row", alignItems: "center", gap: 7, maxWidth: "100%" },
  wishlistSummaryText: { flexShrink: 1, fontFamily: "ManropeBold", fontSize: 13, color: "#fff" },
  wishlistSort: {
    minHeight: 44, maxWidth: "100%", paddingHorizontal: 13, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 22, backgroundColor: "#fff",
  },
  wishlistBrowse: { backgroundColor: C.sunSoft },
  wishlistSortText: { flexShrink: 1, fontFamily: "ManropeBold", fontSize: 13, color: C.ink },
  wishlistArtwork: { flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center" },
  wishlistWatermarkFrame: { width: "86%", maxWidth: 335, height: "95%" },
  watermarkFrame: { width: "72%", maxWidth: 280, aspectRatio: 1.2 },
  watermarkImage: { width: "100%", height: "100%" },
  advisorPostCard: { padding: 18, gap: 12, backgroundColor: "#FFFDF7" },
  advisorPostShortcut: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 11,
    borderRadius: 18, backgroundColor: C.sunSoft,
  },
  advisorPostShortcutCopy: { flex: 1, minWidth: 0, gap: 2 },
  advisorPostShortcutTitle: { color: C.ink, fontFamily: "ManropeExtraBold", fontSize: 15 },
  advisorPostShortcutHint: { color: C.muted, fontFamily: font, fontSize: 12 },
  advisorPostIcon: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: C.sun,
    alignItems: "center", justifyContent: "center",
  },
  advisorPostTitle: { fontFamily: fontDisplay, fontSize: 22, lineHeight: 27, color: C.ink },
  advisorPostDescription: { fontFamily: font, fontSize: 14, lineHeight: 20, color: C.muted },
  advisorPostArtwork: { minHeight: 152, maxHeight: 265, marginTop: 10 },
  postWatermarkFrame: { flex: 1, minHeight: 0, width: "86%", maxWidth: 420, alignSelf: "center" },
  postPrepIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF1C0" },
  content: { width: "100%", maxWidth: 1180, alignSelf: "center", padding: 20, gap: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  searchControls: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchInputRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", padding: 4, borderRadius: 16, backgroundColor: "#fff" },
  searchInputText: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 8, color: C.ink, fontSize: 14 },
  searchSubmit: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.sun },
  searchResultsControls: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 },
  searchFilterPanel: { gap: 12 },
  searchFilterHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchFilterIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "#FFF1C0", alignItems: "center", justifyContent: "center" },
  searchFilterTitle: { flex: 1, color: C.ink, fontFamily: "Fraunces", fontSize: 21 },
  searchFilterClose: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" },
  searchFilterChip: { minHeight: 44, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  searchFilterChipSelected: { backgroundColor: C.ink, borderColor: C.ink },
  searchFilterChipTextSelected: { color: C.sun },
  searchMapLoading: { alignItems: "center", justifyContent: "center", zIndex: 1100, backgroundColor: "rgba(20,38,62,0.16)" },
  searchMapLoadingPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, backgroundColor: "#fff" },
  searchMapLoadingText: { color: C.ink, fontFamily: "ManropeBold" },
  searchMapLocation: { position: "absolute", top: 10, right: 10, zIndex: 1001, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: C.sun, elevation: 3 },
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
  dangerButton: { backgroundColor: "#FFF0F2", borderWidth: 1, borderColor: "#EAC3CA", shadowOpacity: 0, elevation: 0 },
  dangerButtonText: { color: "#A52239" },
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
    paddingHorizontal: 20, paddingBottom: 16, backgroundColor: C.ink,
    borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden",
  },
  compactHero: { paddingBottom: 13 },
  smallHero: { paddingHorizontal: 16, paddingBottom: 10 },
  smallHeroSubtitle: { fontSize: 13, lineHeight: 18 },
  heroSun: {
    position: "absolute", width: 178, height: 178, borderRadius: 89,
    right: -52, top: -58, backgroundColor: C.sun,
  },
  heroRay: {
    position: "absolute", width: 74, height: 210, borderRadius: 40,
    right: 62, top: 70, backgroundColor: "#1C3556", transform: [{ rotate: "-30deg" }],
  },
  illustratedHeroTitle: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroTitle: { fontFamily: fontDisplay, fontSize: brandHeader.headingSize, lineHeight: brandHeader.headingLineHeight, color: "#fff" },
  heroSubtitle: { fontFamily: font, fontSize: 14, lineHeight: 20, color: "rgba(255,255,255,0.78)" },
  homeDistrict: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 8,
    minHeight: 44, maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: C.sunSoft, borderRadius: 22,
  },
  homeDistrictLabel: { fontFamily: "ManropeBold", fontSize: 13, color: C.ink, flexShrink: 1 },
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
  dockArtwork: { position: "absolute", left: 0, right: 0, bottom: 0 },
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
    height: dockHeight,
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
  scrollViewport: { flex: 1 },
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
  guestAccountCard: { padding: 20, gap: 14, backgroundColor: "#FFFDF7" },
  guestAccountHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  guestAccountTitle: { flex: 1, fontFamily: fontDisplay, fontSize: 25, lineHeight: 30, color: C.ink },
  guestAccountIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.sunSoft, alignItems: "center", justifyContent: "center" },
  guestAccountDescription: { fontFamily: font, fontSize: 14, lineHeight: 21, color: C.muted },
  profileHeaderCopy: { flexShrink: 1, minWidth: 0 },
  guestProfileHero: { paddingBottom: 24 },
  spacedBrandGroup: { gap: 16 },
  profileHeroCaption: { fontSize: 13, lineHeight: 15 },
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
