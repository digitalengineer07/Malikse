# Property recommendations

The home feed uses the website's rule-based ranking and property classification.
The categories are For you, Residential, Commercial, Investment and Budget.
Customize feed sets a preferred district, purpose and maximum budget. These are
ranking preferences; the normal search filters remain hard filters.

Public property detail views and successful wishlist additions update the local
interest profile. Returning to the feed refreshes the ranking. Preferences and
interaction history persist in AsyncStorage on this installation, including for
guest browsing; they are not synchronized with the website or other devices and
are not scoped to individual signed-in accounts. Reset preferences clears the
explicit preferences while retaining browsing history, as on the website.

Recommendations rank the current fetched page. All ranked results remain
accessible, with the existing cursor pagination; the app does not silently hide
items beyond the website's default 16-item recommendation limit. Like the
website, an empty category falls back to the fetched property list.

The algorithm has no trained ML weights or remote inference dependency. Storage
failure falls back to an in-memory profile. Existing map/preload behavior is
unchanged.

Run `node scripts/check-recommendations.cjs` to verify website ranking parity,
categories, interaction learning, persistent reload, reset and corruption
recovery. Run `npx tsc --noEmit` for the screen and service type checks.
