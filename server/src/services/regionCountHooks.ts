import type { Schema } from "mongoose";

// Resolve lazily: the updater also uses Property/User after model registration.
const dirty = () => import("./regionCountStore").then(store => store.markRegionCountsDirty());
export function regionCountHooks(schema: Schema, options: { account?: boolean } = {}) {
  const touched = new WeakSet<object>();
  const fields = options.account ? ["isSuspended", "isActive"] : ["ownerId", "type", "location", "status", "badges", "advisorReview", "verifierReview"];
  const relevant = (context: any, op: string) => {
    if (/delete|replace|insert|bulk/i.test(op)) return true;
    if (op === "save") return context.isNew || fields.some(field => context.isModified(field));
    const update = context.getUpdate?.();
    if (Array.isArray(update)) return true;
    return Object.entries(update || {}).some(([operator, values]) => {
      const keys = operator.startsWith("$") ? Object.keys(values as object || {}) : [operator];
      return operator === "$rename" || keys.some(key => fields.some(field => key === field || key.startsWith(field + ".")));
    });
  };
  for (const op of ["save", "updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
    (schema as any).pre(op, async function(this: any) { if (relevant(this, op)) { touched.add(this);await dirty(); } });
    (schema as any).post(op, async function(this: any) { if (touched.has(this)) { touched.delete(this);await dirty(); } });
    (schema as any).post(op, function(this: any, error: Error, _result: unknown, next: (error: Error) => void) {
      if (!touched.has(this)) { next(error);return; }
      touched.delete(this);
      void dirty().then(() => next(error), () => next(error));
    });
  }
  for (const op of ["insertMany", "bulkWrite"]) {
    (schema as any).pre(op, async function() { await dirty(); });
    (schema as any).post(op, async function() { await dirty(); });
    (schema as any).post(op, function(error: Error, _result: unknown, next: (error: Error) => void) { void dirty().then(() => next(error), () => next(error)); });
  }
}
