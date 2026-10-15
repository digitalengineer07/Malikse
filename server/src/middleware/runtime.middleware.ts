import { randomUUID } from "crypto";
import type { ErrorRequestHandler, Express, RequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { performanceMetrics } from "../services/performanceMetrics";

export function positiveInteger(name: string, fallback: number, maximum = 100000) {
  const value = process.env[name] === undefined ? fallback : Number(process.env[name]);
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw new Error(`Invalid ${name}`);
  return value;
}

export function runtimeConfiguration() {
  const production = process.env.NODE_ENV === "production";
  const origins = (process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
  if (production && !origins.length) throw new Error("Configure CORS_ORIGINS in production");
  for (const origin of origins) {
    const url = new URL(origin);
    if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) || (production && url.protocol !== "https:")) throw new Error("CORS_ORIGINS must contain exact HTTP(S) origins (HTTPS in production)");
  }
  const proxies = (process.env.TRUSTED_PROXIES || "").split(",").map(value => value.trim()).filter(Boolean);
  return { production, origins, proxies };
}

export function installRuntimeMiddleware(app: Express) {
  const { production, origins, proxies } = runtimeConfiguration();
  app.set("trust proxy", proxies.length ? proxies : false);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    performanceMetrics.requests++;
    res.once("finish", () => { performanceMetrics.completed++; if (res.statusCode >= 500) performanceMetrics.serverErrors++; });
    res.once("close", () => { if (!res.writableFinished) performanceMetrics.aborted++; });
    const requestId = randomUUID();
    const start = process.hrtime.bigint();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Cache-Control", "no-store");
    res.locals.requestId = requestId;
    if (process.env.REQUEST_LOGS === "true" || (production && process.env.REQUEST_LOGS !== "false")) {
      res.once("finish", () => console.log(JSON.stringify({ event: "http_request", requestId, method: req.method,
        route: req.route ? `${req.baseUrl}${req.route.path}` : "unmatched",
        status: res.statusCode, durationMs: Number(process.hrtime.bigint() - start) / 1e6 })));
    }
    next();
  });
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => callback(null, !origin || origins.includes(origin) || (!production && !origins.length)),
    exposedHeaders: ["X-Request-Id", "X-Search-Cache", "X-Next-Cursor", "RateLimit", "Retry-After"],
  }));
  for (const [path, name, limit] of [
    ["/auth/login", "AUTH_LOGIN_LIMIT", 20],
    ["/auth/register", "AUTH_REGISTER_LIMIT", 10],
    ["/auth/refresh", "AUTH_REFRESH_LIMIT", 60],
  ] as const) {
    app.use(path, rateLimit({
      windowMs: 60_000, limit: positiveInteger(name, limit),
      standardHeaders: "draft-8", legacyHeaders: false,
      skip: req => req.method !== "POST",
      message: { message: "Too many authentication requests. Please try again shortly." },
    }));
  }
}

export const notFound: RequestHandler = (_req, res) => { res.status(404).json({ message: "Endpoint not found" }); };

export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error?.type === "entity.too.large" || error?.code === "LIMIT_FILE_SIZE" ? 413
    : error instanceof SyntaxError || error?.name === "MulterError" ? 400 : 500;
  res.status(status).json({ message: status === 413 ? "Request exceeds the size limit" : status === 400 ? "Invalid request body" : "An unexpected server error occurred", requestId: res.locals.requestId });
};
