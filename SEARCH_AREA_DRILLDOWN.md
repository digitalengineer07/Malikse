# Search by area

Implemented 12 October 2026.

## User flow

1. Search loads counts grouped by state. It does not request property cards or details.
2. Selecting a state on the map or in the list zooms toward that state's listing locations and loads district counts.
3. Selecting a district zooms further and loads pincode counts.
4. Selecting a pincode opens Home with exact state, district, pincode and property-type filters. Home loads up to 50 cards at a time using Next/Previous cursor pagination.

Breadcrumbs return to an earlier level. The search box searches across every state, district, pincode and stored address component; it is no longer limited to the current map level. Suggestions appear below the input. Selecting a state/district changes the map level, selecting a pincode opens its Home results, and pressing Enter opens Home results for the entered address text. Changing the property type refreshes counts and suggestions. The bottom count/list panel was removed at the user's request; loading, empty and retry messages appear by the search controls. Pending requests are cancelled when navigating away or changing the area.

## Data and API

- `GET /properties/regions` returns state counts.
- `GET /properties/regions?state=Bihar` returns district counts.
- `GET /properties/regions?state=Bihar&district=Patna` returns pincode counts.
- Optional `type` applies at every level.
- Responses contain only `level` and groups of `{ key, name, count, lat, lng }`. Positions are averages of matching property coordinates, not administrative boundary centroids. No boundary datasets or geocoding requests are needed.
- Counts include only published properties belonging to active, unsuspended owners. MongoDB aggregates the results; cached responses reuse the existing bounded public cache, compression, admission control and mutation invalidation.
- `GET /properties/search?view=cards&state=...&district=...&pincode=...&limit=50` serves Home. Cursor filters retain the same location scope.
- `GET /properties/regions/suggest?q=...` returns up to 20 matching state, district, pincode or address suggestions. It reads only projected location/title/owner fields from a bounded 500-property candidate set, checks owner visibility, and uses the existing public response cache. The client debounces requests for 250 ms and cancels stale requests.
- `GET /properties/search?view=cards&address=...` searches the stored state, district, pincode, block, mauza, police station and title fields, then paginates on Home. Regex metacharacters are escaped. Only address text stored on a listing can match; a street or landmark absent from the database cannot be inferred.

Pincode is a new optional `location.pincode` string in the model, listing editor and client types. Nonempty values must be six digits beginning with 1–9. Existing listings without pincodes are grouped under **Pincode not provided**, using `__missing__` as the filter key. Existing records have not been assigned invented pincodes or modified in the real database. Owners can add their correct pincode in the listing editor.

An additive `public_pincode_newest` partial index supports state/district/pincode plus newest-first paging. Apply the existing index migration during deployment; it was created only in the disposable local test database here. Existing single-writer cache deployment restrictions still apply.

## Verification

- Backend build and frontend `tsc --noEmit`: passed.
- `npm run test:regions`: passed state/district/pincode counts, global suggestions, direct address searches, literal regex input, parent/type filters, missing pincodes, hidden-owner/draft exclusion, 51 listings across three cursor pages, slim payload shape, zero-read warm cache, malformed-input rejection and invalidation after suspension/pincode changes.
- Existing public-cache regression suite: passed.
- The two-state fixture returned a 171-byte count payload. This illustrates payload reduction; it is not a load-capacity measurement.
- Browser/native visual validation remains outstanding. Automatic approval review rejected starting the Expo web preview with “blocked by policy”; no visual-test success is claimed.

Main files: `app/components/MarketplaceScreen.tsx`, `RegionCountMap.tsx`, `RegionCountMap.native.tsx`, `VerifiedHomeScreen.tsx`, `server/src/services/propertyRegions.ts`, and `server/load/test-regions.cjs`.
