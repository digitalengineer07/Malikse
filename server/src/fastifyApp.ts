import { randomUUID } from "crypto";
import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import accepts from "accepts";
import qs from "qs";
import { createApp } from "./app";
import { runtimeConfiguration } from "./middleware/runtime.middleware";
import { pageInput, cursorFor, listFields } from "./services/pagination";
import { performanceMetrics } from "./services/performanceMetrics";
import { getPublicSearchResponse } from "./services/propertySearch";
import { regionCounts } from "./services/propertyRegions";
import { locationSuggestions } from "./services/propertyLocationSuggestions";
import { PublicResponse, publicResponse } from "./services/publicResponseCache";
import { assertPublicGeneration } from "./services/publicCacheGeneration";
import { authenticateRequest } from "./middleware/auth.middleware";
import { isValidObjectId } from "mongoose";
import { Property } from "./models/Property.model";
import { User } from "./models/User.model";
import { canReadProperty, publicFields } from "./services/propertyWorkflow";
import { publishedFilter } from "./services/marketplace";

function sendPublicResponse(request: FastifyRequest, reply: FastifyReply, value: PublicResponse) {
  assertPublicGeneration(value.generation);
  const { entry } = value;
  const choices = [...(entry.br ? ["br"] : []), ...(entry.gzip ? ["gzip"] : []), "identity"];
  const encoding = request.headers["accept-encoding"] ? accepts(request.raw).encodings(choices) : "identity";
  const vary = reply.getHeader("Vary");
  reply.header("Vary", vary ? `${vary}, Accept-Encoding` : "Accept-Encoding");
  if (!encoding) return reply.code(406).send();
  const body = encoding === "br" ? entry.br! : encoding === "gzip" ? entry.gzip! : entry.body;
  reply.header("X-Next-Cursor", entry.nextCursor);
  reply.header("X-Search-Cache", value.cacheHit ? "HIT" : "MISS");
  if (encoding !== "identity") reply.header("Content-Encoding", encoding);
  return reply.code(entry.status).type("application/json; charset=utf-8").header("Content-Length", body.length).send(body);
}

/** All property GET routes are native; other APIs remain on Express. */
export function createFastifyApp(isReady?: () => boolean) {
  const { production, origins, trustProxy } = runtimeConfiguration();
  const app = Fastify({
    bodyLimit: 100 * 1024,
    requestTimeout: 60_000,
    trustProxy,
    genReqId: () => randomUUID(),
    routerOptions: {
      ignoreTrailingSlash: true,
      caseSensitive: false,
      querystringParser: value => qs.parse(value),
    },
  });
  app.server.headersTimeout = 15_000;
  const legacy = createApp(isReady);

  // Handoff happens before body parsing so Express JSON and multipart middleware
  // receive the original, unread request stream.
  app.addHook("onRequest", (request, reply, done) => {
    const path = (request.raw.url || "").split("?")[0].replace(/\/$/, "").toLowerCase();
    if (isReady && !isReady() && path !== "/health" && path !== "/ready") {
      reply.code(503).header("Retry-After", "1").send({ message: "Service is initializing. Please try again shortly." });
      done();
      return;
    }
    if (!(request.routeOptions.config as { nativePropertyRead?: boolean }).nativePropertyRead) {
      reply.hijack();
      legacy(request.raw, reply.raw);
    }
    done();
  });

  app.register(async native => {
    native.addHook("onRequest", async (request, reply) => {
      performanceMetrics.requests++;
      const start = process.hrtime.bigint();
      reply.header("X-Request-Id", request.id).header("Cache-Control", "no-store");
      reply.raw.once("finish", () => {
        performanceMetrics.completed++;
        if (reply.raw.statusCode >= 500) performanceMetrics.serverErrors++;
        if (process.env.REQUEST_LOGS === "true" || (production && process.env.REQUEST_LOGS !== "false")) {
          console.log(JSON.stringify({ event: "http_request", requestId: request.id, method: request.method,
            route: request.routeOptions.url, status: reply.raw.statusCode,
            durationMs: Number(process.hrtime.bigint() - start) / 1e6 }));
        }
      });
      reply.raw.once("close", () => { if (!reply.raw.writableFinished) performanceMetrics.aborted++; });
    });
    await native.register(helmet);
    await native.register(cors, {
      origin: (origin, callback) => callback(null, !origin || origins.includes(origin) || (!production && !origins.length)),
      exposedHeaders: ["X-Request-Id", "X-Search-Cache", "X-Next-Cursor", "RateLimit", "Retry-After"],
      preflight: false, // OPTIONS is handled by the existing Express CORS middleware.
    });
    native.addHook("preValidation", async (request, reply) => {
      if (request.method !== "GET") return;
      const query = request.query as Record<string, unknown>;
      try {
        pageInput(query);
        for (const key of Object.keys(query)) if (key.endsWith("Cursor")) pageInput({ ...query, cursor: query[key] });
      } catch (error: any) { return reply.code(400).send({ message: error.message }); }
    });
    native.setErrorHandler((error: any, request, reply) => {
      const status = error.statusCode === 413 ? 413 : error.statusCode === 400 ? 400 : 500;
      reply.code(status).send({ message: status === 413 ? "Request exceeds the size limit" : status === 400 ? "Invalid request body" : "An unexpected server error occurred", requestId: request.id });
    });
    for (const route of [
      { path: "/properties/search", read: getPublicSearchResponse, busy: "Search is busy. Please try again shortly.", mongo: /Mongo|MongooseServerSelection/ },
      { path: "/properties/regions", read: regionCounts, busy: "Area counts are busy. Please try again shortly.", mongo: /Mongo|Mongoose/ },
      { path: "/properties/regions/suggest", read: locationSuggestions, busy: "Address search is busy. Please try again shortly.", mongo: /Mongo|Mongoose/ },
    ]) {
      native.get(route.path, { config: { nativePropertyRead: true } }, async (request, reply) => {
        try { return sendPublicResponse(request, reply, await route.read(request.query as Record<string, unknown>)); }
        catch (error: any) {
          const unavailable = error.status === 503 || error.code === 50 || route.mongo.test(error.name || "");
          if (unavailable) reply.header("Retry-After", "1");
          return reply.code(unavailable ? 503 : 400).send({ message: unavailable ? route.busy : error.message });
        }
      });
    }
    native.get("/properties/mine", { config: { nativePropertyRead: true } }, async (request, reply) => {
      const auth = await authenticateRequest(request.headers.authorization);
      if (auth.status) return reply.code(auth.status).send({ message: auth.message });
      if (auth.user!.role !== "user") return reply.code(403).send({ message: "Forbidden: insufficient role" });
      try {
        const { limit, filter } = pageInput(request.query);
        const rows = await Property.find({ ownerId: auth.user!.id }).select(listFields).and([filter])
          .sort({ createdAt: -1, _id: -1 }).limit(limit + 1).maxTimeMS(5000).lean();
        reply.header("X-Next-Cursor", rows.length > limit ? cursorFor(rows[limit - 1]) : "");
        return reply.send(rows.slice(0, limit));
      } catch { return reply.code(500).send({ message: "An unexpected server error occurred" }); }
    });
    native.get<{ Params: { id: string } }>("/properties/:id/workspace", { config: { nativePropertyRead: true } }, async (request, reply) => {
      if (!isValidObjectId(request.params.id)) return reply.code(400).send({ message: "Invalid property ID" });
      const auth = await authenticateRequest(request.headers.authorization);
      if (auth.status) return reply.code(auth.status).send({ message: auth.message });
      try {
        const property = await Property.findById(request.params.id);
        if (!property) return reply.code(404).send({ message: "Property not found" });
        if (!canReadProperty(property, auth.user!)) return reply.code(403).send({ message: "This property is not assigned to you" });
        await property.populate([{ path: "ownerId", select: "name mobile" }, { path: "assignedAdvisorId", select: "name" }, { path: "assignedVerifierId", select: "name" }]);
        return reply.send(property.toJSON());
      } catch (error: any) { return reply.code(400).send({ message: error.message }); }
    });
    native.get<{ Params: { id: string } }>("/properties/:id", { config: { nativePropertyRead: true } }, async (request, reply) => {
      if (!isValidObjectId(request.params.id)) return reply.code(400).send({ message: "Invalid property ID" });
      try {
        const response = await publicResponse({ db: Property.db.name, kind: "detail", id: request.params.id }, async () => {
          const property = await Property.findOne({ ...publishedFilter, _id: request.params.id }).select(publicFields + " ownerId").maxTimeMS(1500).lean();
          const owner = property && await User.exists({ _id: property.ownerId, isSuspended: { $ne: true }, isActive: { $ne: false } }).maxTimeMS(1000);
          if (!property || !owner) return { data: { message: "Published property not found" }, status: 404 };
          const { ownerId: _owner, ...dto } = property;
          return { data: dto };
        });
        return sendPublicResponse(request, reply, response);
      } catch { return reply.header("Retry-After", "1").code(503).send({ message: "Search is busy. Please try again shortly." }); }
    });
  });
  return app;
}
