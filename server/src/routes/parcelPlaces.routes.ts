import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { authGuard, roleGuard } from "../middleware/auth.middleware";

const router = Router();
const googlePlacesBase = "https://places.googleapis.com/v1";
const validToken = (token: unknown): token is string =>
  typeof token === "string" && /^[a-zA-Z0-9_-]{1,36}$/.test(token);

router.use(authGuard, roleGuard("user"), rateLimit({
  windowMs: 60_000,
  limit: 90,
  keyGenerator: req => (req as typeof req & { user: { id: string } }).user.id,
  standardHeaders: "draft-8",
  legacyHeaders: false,
}));

function getPlacesKey(res: Response) {
  res.setHeader("Cache-Control", "no-store");
  const key = process.env.GOOGLE_PLACES_SERVER_API_KEY?.trim();
  if (!key) res.status(503).json({ code: "PLACES_NOT_CONFIGURED", message: "Google address search is unavailable." });
  return key;
}

router.post("/autocomplete", async (req, res) => {
  const input = typeof req.body?.input === "string" ? req.body.input.trim() : "";
  const sessionToken = req.body?.sessionToken;
  if (input.length < 3 || input.length > 200 || !validToken(sessionToken)) {
    return res.status(400).json({ message: "Enter an address to search." });
  }
  const key = getPlacesKey(res);
  if (!key) return;
  try {
    const response = await fetch(`${googlePlacesBase}/places:autocomplete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
      },
      body: JSON.stringify({ input, sessionToken, includedRegionCodes: ["in"] }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Autocomplete unavailable");
    const data = await response.json() as { suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[] };
    res.json((data.suggestions ?? []).flatMap(({ placePrediction }) =>
      placePrediction?.placeId && placePrediction.text?.text
        ? [{ placeId: placePrediction.placeId, label: placePrediction.text.text }]
        : [],
    ).slice(0, 5));
  } catch {
    res.status(502).json({ message: "Google address search is unavailable. Try again shortly." });
  }
});

router.post("/resolve", async (req, res) => {
  const { placeId, sessionToken } = req.body ?? {};
  if (typeof placeId !== "string" || !/^[A-Za-z0-9_-]{1,500}$/.test(placeId) || !validToken(sessionToken)) {
    return res.status(400).json({ message: "Choose an address from the suggestions." });
  }
  const key = getPlacesKey(res);
  if (!key) return;
  try {
    const query = new URLSearchParams({ sessionToken });
    const response = await fetch(`${googlePlacesBase}/places/${encodeURIComponent(placeId)}?${query}`, {
      headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 404) return res.status(404).json({ message: "This address is no longer available. Search again." });
    if (!response.ok) throw new Error("Place details unavailable");
    const data = await response.json() as { location?: { latitude?: number; longitude?: number } };
    const lat = data.location?.latitude;
    const lng = data.location?.longitude;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(404).json({ message: "Google Maps did not return coordinates for this address." });
    }
    res.json({ lat, lng });
  } catch {
    res.status(502).json({ message: "Could not load this address. Search again to retry." });
  }
});

export default router;
