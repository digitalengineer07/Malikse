import { randomUUID } from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
  View,
  useWindowDimensions,
} from "react-native";
import {
  useFocusEffect,
  useLocalSearchParams,
  usePathname,
  useRouter,
} from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api, { authService } from "../src/services/authService";
import { useAuthStore } from "../src/store/authStore";
import { userService } from "../src/services/userService";
import { prepareUpload } from "../src/services/prepareUpload";
import VerifiedPropertyMap from "./VerifiedPropertyMap";
import MapParcelPicker, { LatLngPoint } from "./MapParcelPicker";
import { dashboardRoutes } from "../src/utils/accountRoutes";
const C = {
  bg: "transparent",
  ink: "#071a45",
  muted: "#3d5278",
  blue: "#0a45b5",
  line: "rgba(10, 69, 181, 0.12)",
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
      {icon && <Icon name={icon} color={secondary ? C.blue : "white"} size={17} />}
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
}: any) {
  return (
    <View style={{ flex: 1, minWidth: 140, gap: 5 }}>
      <Text style={s.fieldLabel}>{title}</Text>
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
  const refresh = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError("");
    try {
      const response = await api.get(path);
      setData(response.data);
      setNextCursor(response.headers["x-next-cursor"] || null);
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
      setNextCursor(response.headers["x-next-cursor"] || null);
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
  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View
        style={[s.header, { height: 58 + insets.top, paddingTop: insets.top }]}
      >
        <View style={[s.row, { flex: 1 }]}>
          {back ? (
            <Pressable
              accessibilityLabel="Back"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/home")
              }
            >
              <Icon name="arrow-back" size={20} />
            </Pressable>
          ) : (
            <View style={s.logoIcon}>
              <Icon name="roofing" color="white" size={18} />
            </View>
          )}
          <Pressable onPress={() => router.push("/home")}>
            <Text style={s.logo}>
              MalikSe<Text style={{ color: "#0b8a3e" }}>.</Text>
            </Text>
          </Pressable>
          {width > 850 && (
            <Text style={s.muted}>Verified spaces. Trusted connections.</Text>
          )}
        </View>
        <Pressable
          accessibilityLabel="Wishlist"
          onPress={() => router.push("/saved")}
        >
          <Icon name="favorite-border" size={20} />
        </Pressable>
        <Pressable
          accessibilityLabel="Profile"
          onPress={() => router.push("/profile")}
          style={s.avatar}
        >
          <Text style={s.avatarText}>{user?.name?.[0] || "M"}</Text>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.content}>
          {Boolean(title) && (
            <View style={{ gap: 4 }}>
              <Text style={s.h1}>{title}</Text>
              {Boolean(subtitle) && <Text style={s.muted}>{subtitle}</Text>}
            </View>
          )}
          {children}
        </View>
      </ScrollView>
      <View
        style={[s.dockWrapper, { bottom: Math.max(insets.bottom, 8), pointerEvents: "box-none" }]}
      >
        <View style={s.nav}>
          {[
            ["/home", "home", "Home"],
            ["/search", "search", "Search"],
            ["/post", "add", "Post"],
            ["/messages", "chat-bubble-outline", "Chats"],
            ["/profile", "person-outline", "Profile"],
          ].map(([url, icon, text]) => {
            const isActive = path === url;
            const isPost = url === "/post";
            return (
              <Pressable
                key={url}
                accessibilityRole="button"
                onPress={() => router.push(url as any)}
                style={[s.navItem, isActive && !isPost && s.navItemActive]}
              >
                {isPost ? (
                  <View style={s.postCircle}>
                    <Icon name="add" color="white" size={22} />
                  </View>
                ) : (
                  <Icon
                    name={icon}
                    color={isActive ? C.blue : C.muted}
                    size={20}
                  />
                )}
                <Text
                  style={[
                    s.navText,
                    isActive && { color: C.blue, fontWeight: "800" },
                  ]}
                >
                  {text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
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
            style={s.heartBtn}
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
            <Icon name={saved ? "favorite" : "favorite-border"} color={saved ? "#e11d48" : C.muted} size={18} />
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
      title={`Hello${user ? ", " + user.name.split(" ")[0] : ", welcome"} 👋`}
      subtitle="Find your next place, verified by people you can trust."
    >
      <View style={{ gap: 12 }}>
        <View style={[s.typeChip, { alignSelf: "flex-start", backgroundColor: "rgba(255, 255, 255, 0.94)", borderColor: "rgba(10, 69, 181, 0.16)", paddingHorizontal: 12, paddingVertical: 6, gap: 6 }]}>
          <Icon name="location-on" size={17} color={C.blue} />
          <Text style={[s.cardTitle, { fontSize: 13, color: C.ink }]}>
            {prefs.district || "Explore your preferred location"}
          </Text>
        </View>
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
            <Icon name={icon} color={type === id ? "white" : C.blue} size={16} />
            <Text style={[{ fontSize: 12, fontWeight: "600" }, { color: type === id ? "white" : C.ink }]}>{text}</Text>
          </Pressable>
        ))}
      </ScrollView>
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
        <View style={[s.input, s.row, { flex: 1, minWidth: 180, backgroundColor: "#ffffff" }]}>
          <Icon name="search" size={19} />
          <TextInput
            accessibilityLabel="Search properties"
            value={query}
            onChangeText={setQuery}
            placeholder="City, district or property"
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
  return (
    <MarketplaceShell title="Your account">
      <Protected>
        {user && (
          <>
            <View style={[s.panel, { alignItems: "center", padding: 20 }]}>
              <View
                style={[s.avatar, { width: 60, height: 60, borderRadius: 30 }]}
              >
                <Text style={[s.avatarText, { fontSize: 22 }]}>
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
          {Boolean(feed.data?.identityReview?.notes) && (
            <Text style={s.muted}>{feed.data.identityReview.notes}</Text>
          )}
        </View>
        <ErrorBox text={feed.error || action.error} />
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
    [documents, setDocuments] = useState<DocumentPicker.DocumentPickerAsset[]>(
      [],
    ),
    [form, setForm] = useState<any>({
      title: "",
      description: "",
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
  }, [params.id, user?.id]);
  const pick = async (doc = false) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: doc
        ? ["application/pdf", "image/jpeg", "image/png"]
        : ["image/jpeg", "image/png", "image/webp"],
      multiple: true,
      copyToCacheDirectory: true,
    });
    if (!result.canceled)
      doc ? setDocuments(result.assets) : setPhotos(result.assets);
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
      for (const asset of documents) {
        const prepared = await prepareUpload(asset, true),
          body = new FormData();
        body.append("uploadId", uploadKey(asset.uri));
        body.append("propertyId", id);
        body.append("type", "Registry");
        if (Platform.OS === "web")
          body.append("file", prepared.file, prepared.name);
        else body.append("file", prepared.file as any);
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
                  title="Property title"
                  value={form.title}
                  onChangeText={set("title")}
                />
                <Field
                  title="Description"
                  value={form.description}
                  onChangeText={set("description")}
                  multiline
                />
              </View>
            )}
            {step === 2 && (
              <View style={s.panel}>
                <Text style={s.h2}>Where is the property located?</Text>
                {[
                  ["state", "State"],
                  ["district", "City / district"],
                  ["block", "Locality"],
                  ["pincode", "Pincode"],
                ].map(([key, title]) => (
                  <Field
                    key={key}
                    title={title}
                    value={form[key]}
                    onChangeText={set(key)}
                  />
                ))}
                <Button
                  secondary
                  title="Use current location"
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
                    title="Latitude"
                    value={form.lat}
                    onChangeText={set("lat")}
                    numeric
                  />
                  <Field
                    title="Longitude"
                    value={form.lng}
                    onChangeText={set("lng")}
                    numeric
                  />
                </View>
                <Text style={s.small}>
                  Enter the property's coordinates if you are not currently at
                  the site.
                </Text>

                <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.line }}>
                  <Text style={s.h2}>Demarcate Property Boundary</Text>
                  <Text style={s.muted}>
                    Draw the boundary outline on the satellite map. Tap points around the plot corners to mark the perimeter.
                  </Text>
                  <View
                    style={{
                      minHeight: Platform.OS === "web" ? 520 : 440,
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
                    value={form.boundary}
                    onChangeText={set("boundary")}
                    multiline
                  />
                  <Field
                    title="Road width in front of plot (feet)"
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
                {[
                  ["price", "Expected price (₹)"],
                  ["totalArea", "Total area (sq ft)"],
                  ["sellableArea", "Sellable area (sq ft)"],
                ].map(([key, title]) => (
                  <Field
                    numeric
                    key={key}
                    title={title}
                    value={form[key]}
                    onChangeText={set(key)}
                  />
                ))}
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
                  title="Possession status"
                  value={form.possessionStatus}
                  onChangeText={set("possessionStatus")}
                />
              </View>
            )}
            {step === 4 && (
              <View style={s.panel}>
                <Text style={s.h2}>Photos & ownership documents</Text>
                <Text style={s.muted}>
                  At least one property photo is required. Ownership documents
                  remain private.
                </Text>
                <Button
                  secondary
                  title="Add property photos"
                  icon="add-a-photo"
                  onPress={() => action.run(() => pick())}
                />
                <View style={s.wrap}>
                  {[...form.media.photos, ...photos.map((p) => p.uri)].map(
                    (uri: string) => (
                      <Image
                        key={uri}
                        source={{ uri }}
                        style={{ width: 120, height: 90, borderRadius: 12 }}
                      />
                    ),
                  )}
                </View>
                <Button
                  secondary
                  title="Add ownership documents (optional)"
                  icon="upload-file"
                  onPress={() => action.run(() => pick(true))}
                />
                {documents.map((d) => (
                  <Text key={d.uri} style={s.small}>
                    {d.name}
                  </Text>
                ))}
              </View>
            )}
            {step === 5 && (
              <View style={s.panel}>
                <Text style={s.h2}>Assign your property team</Text>
                <Field
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
                onPress={() => (step === 5 ? submit() : setStep(step + 1))}
              />
            </View>
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
const font =
  Platform.OS === "web" ? "'Manrope', 'Inter', system-ui, sans-serif" : "PoppinsRegular";
const fontDisplay =
  Platform.OS === "web" ? "'Fraunces', Georgia, serif" : "PoppinsBold";
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  header: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    borderBottomWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.10)",
    shadowColor: "#0a2a6b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    zIndex: 10,
  },
  logo: {
    fontFamily: fontDisplay,
    fontSize: 21,
    fontWeight: "800",
    color: C.blue,
    letterSpacing: -0.5,
  },
  logoIcon: { backgroundColor: C.blue, padding: 5, borderRadius: 10 },
  scroll: { padding: 16, paddingBottom: 100 },
  content: { width: "100%", maxWidth: 1140, alignSelf: "center", gap: 18 },
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
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.4,
    textShadowColor: "rgba(255, 255, 255, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  h2: {
    fontFamily: fontDisplay,
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.3,
    textShadowColor: "rgba(255, 255, 255, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  muted: { fontFamily: font, fontSize: 12.5, lineHeight: 18, color: C.muted, fontWeight: "500" },
  small: { fontFamily: font, fontSize: 11.5, lineHeight: 16, color: "#4b628c", fontWeight: "600" },
  body: { fontFamily: font, fontSize: 13.5, lineHeight: 21, color: C.ink, fontWeight: "500" },
  fieldLabel: {
    fontFamily: font,
    fontSize: 12,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: 0.1,
  },
  button: {
    minHeight: 38,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: C.blue,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#0a45b5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 2,
  },
  secondary: {
    backgroundColor: "rgba(238, 244, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.18)",
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontFamily: font,
    fontSize: 13,
    fontWeight: "700",
    color: "white",
    letterSpacing: 0.1,
  },
  input: {
    fontFamily: font,
    minHeight: 40,
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.18)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    fontSize: 13.5,
    color: C.ink,
    shadowColor: "#0a2a6b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  hero: {
    padding: 20,
    gap: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(196, 211, 240, 0.75)",
    shadowColor: "#0a2a6b",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 3,
  },
  heroTitle: {
    fontFamily: fontDisplay,
    fontSize: 25,
    lineHeight: 31,
    color: C.ink,
    letterSpacing: -0.5,
    textShadowColor: "rgba(255, 255, 255, 0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.14)",
    shadowColor: "#0a2a6b",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  tagText: { fontFamily: font, fontSize: 11, fontWeight: "700", color: C.blue, letterSpacing: 0.1 },
  typeChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "rgba(196, 211, 240, 0.75)",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#0a2a6b",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  panel: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(196, 211, 240, 0.70)",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    gap: 12,
    shadowColor: "#0a2a6b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  card: {
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(196, 211, 240, 0.70)",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#0a2a6b",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  photo: { height: 180, backgroundColor: "#dce7fa" },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e0eaff",
  },
  imageTags: { position: "absolute", top: 10, left: 10 },
  cardBody: { padding: 14, gap: 6 },
  price: { fontFamily: font, fontSize: 19, lineHeight: 23, fontWeight: "800", color: C.ink, letterSpacing: -0.4 },
  cardTitle: {
    fontFamily: font,
    fontSize: 14.5,
    lineHeight: 20,
    fontWeight: "700",
    color: C.ink,
    letterSpacing: -0.2,
  },
  link: { fontSize: 12.5, fontWeight: "700", color: C.blue },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(26, 86, 219, 0.12)",
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
    maxWidth: 500,
    minHeight: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.98)",
    shadowColor: "#0a2a6b",
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
  navItemActive: {
    backgroundColor: "rgba(26, 86, 219, 0.12)",
  },
  navText: { fontFamily: font, fontSize: 10.5, fontWeight: "600", color: C.muted },
  postCircle: {
    height: 44,
    width: 44,
    borderRadius: 22,
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.blue,
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#0a45b5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 12,
    elevation: 8,
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(240, 244, 255, 0.90)",
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
  chatArea: { gap: 14, minHeight: 240 },
  bubble: { maxWidth: "85%", padding: 12, borderRadius: 16, gap: 5 },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "#dbe8fd",
    borderWidth: 1,
    borderColor: "rgba(10, 69, 181, 0.18)",
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
  progress: { flexDirection: "row", gap: 5 },
  progressPart: {
    height: 4,
    flex: 1,
    borderRadius: 4,
    backgroundColor: "rgba(10, 69, 181, 0.15)",
  },
});
