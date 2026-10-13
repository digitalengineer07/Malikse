# Search boundary map

Search renders state, district, and pincode polygons with different neon outlines, soft glow and translucent fills. Only areas present in the available-property counts are highlighted. Each area gets exactly one small count-only tag, positioned inside the actual polygon rings; holes and concave outlines are respected. Clicking a polygon or its count tag preserves state → district → pincode → paginated Home results. Hover identifies the area. Count tags are keyboard-accessible buttons. Only records without a pincode retain a compact exceptional selector because they have no real boundary.

Web and native share the same boundary matching, styling, and selection code. Native loads the pinned Leaflet.VectorGrid 1.3.0 script; web bundles the same package. Boundary tiles are loaded directly for the visible viewport, cached by the tile service, and do not add property/database queries. The existing API continues returning only aggregate counts. The map still depends on internet access and the external tile services.

## Data attribution and coverage

Tiles are provided by [Indian Open Maps](https://indianopenmaps.com/), with attribution displayed on both maps. Source and license references:

- [State boundaries](https://github.com/ramSeraph/indian_admin_boundaries/releases/tag/states): Survey of India, `SOI_States`; the publisher lists CC0 with source attribution requested.
- [District boundaries](https://github.com/ramSeraph/indian_admin_boundaries/releases/tag/districts): Survey of India, `SOI_Districts`; the publisher lists CC0 with source attribution requested.
- [Pincode boundaries](https://www.data.gov.in/catalog/all-india-pincode-boundary-geo-json): Department of Posts / data.gov.in, GODL; served as `Datagov_Pincode_Boundaries` by Indian Open Maps.

State/district matching normalizes accents and punctuation, handles a small explicit set of former names, and checks the parent state for district matches. Pincodes match exactly. Administrative changes or spelling mismatches may leave an area unhighlighted; the search input remains usable. Missing pincodes are never represented with an invented polygon. These are navigation boundaries, not surveyed property parcel boundaries.

Validation: `node scripts/test-region-boundaries.cjs` and `npx tsc --noEmit` from `app/`. Real state, district, and pincode tiles were downloaded and decoded to verify layer names and feature attributes; the pincode tile returned HTTP 200 with cross-origin access allowed. Interactive browser preview was unavailable because the Codex browser connection timed out.
