# Local demo properties — 150 records

The **local** `malikse` MongoDB database contains **150** clearly labeled sample listings, owned by a dedicated `MalikSe Demo Listings` account. The first six were added on 12 October 2026; 144 more were added after the user's request. Existing customers' listings were not modified.

| Listing | Type | State / district / pincode | Property ID |
| --- | --- | --- | --- |
| DEMO · Patna residential plot | Land | Bihar / Patna / 800001 | `6acd08a65c6de60a0b3f0797` |
| DEMO · Danapur roadside land | Land | Bihar / Patna / 801503 | `6acd08a65c6de60a0b3f07a3` |
| DEMO · Patna detached house | House | Bihar / Patna / 800014 | `6acd08a65c6de60a0b3f07af` |
| DEMO · Gaya agricultural plot | Land | Bihar / Gaya / 823001 | `6acd08a65c6de60a0b3f07bb` |
| DEMO · Pune family home | House | Maharashtra / Pune / 411045 | `6acd08a65c6de60a0b3f07c7` |
| DEMO · Bengaluru garden home | House | Karnataka / Bengaluru / 560066 | `6acd08a65c6de60a0b3f07d1` |

The 144 additional examples vary by type (`land`, `flat`, `house`, `shop`, `office`), price, area, title, coordinates, boundary, state, district and pincode. The full set spans **7 states, 12 state/district pairs and 14 pincodes**. One Patna pincode has 57 demo listings so Home pagination can be exercised over three 20-item pages.

Each listing references one of six images copied from the existing app assets into the local MongoDB GridFS `photos` bucket, has a `http://localhost:5000/property-photos/...` URL, and has four latitude/longitude boundary points. The 144 new listings **reuse those six uploaded images**; 150 distinct photos were not uploaded. Image, coordinate, area, price, and outline are **illustrative sample data**, not a representation of a real parcel or surveyed boundary. This is stated in each listing description. They use the app's published status fields so the sample records appear in the Home and Search flows.

Run the local API at port 5000 to serve the images. The configured app API is `http://localhost:5000`. The seeder is restricted to `mongodb://localhost` or `127.0.0.1` with database name `malikse`; it will refuse an Atlas or other remote connection.

## Commands

From `server/`:

```powershell
npm run seed:demo-properties
npm run verify:demo-properties
```

The seed command is repeatable and checks demo owner/title before insertion. Verification passed for all **150** records, the five property types, state counts, pincode filters, public search/detail responses, GridFS files, image HTTP responses, four-point boundaries and three cursor pages in one pincode. The verifier only reads data.

Four older seed scripts contained embedded MongoDB connection strings. They now read `MONGO_URI` from the environment with a local default. Any credential previously committed or shared through those files should be rotated separately.
