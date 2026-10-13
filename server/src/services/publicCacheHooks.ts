import type { Schema } from "mongoose";
import { beginPublicMutation } from "./publicCacheGeneration";

// Covers writes through the shared models, including jobs and test fixtures.
// External Mongo writers require maintenance mode/restart (see deployment notes).
export function publicCacheHooks(schema: Schema, options: { account?: boolean } = {}) {
  const pending = new WeakMap<object, () => void>();
  function relevant(context: any, op: string) {
    if (!options.account) {
      // Polling an unpublished job must not invalidate the whole catalogue.
      const status = context.getFilter?.().status;
      const update = context.getUpdate?.();
      const unpublished = ["draft", "queued", "pending", "advisor_verified", "correction_required", "rejected"];
      if (/^(updateOne|updateMany|findOneAndUpdate)$/.test(op) && unpublished.includes(status) && update && !Array.isArray(update)
        && Object.keys(update).every(key => ["$set", "$unset", "$inc", "$push", "$pull", "$setOnInsert"].includes(key))
        && update.$set?.status !== "verified" && !update.$unset?.status && update.$setOnInsert?.status !== "verified") return false;
      return true;
    }
    if (/delete|replace|insert|bulk/i.test(op)) return true;
    if (op === "save") return context.isNew || context.isModified("isSuspended") || context.isModified("isActive");
    const update = context.getUpdate?.();
    return Array.isArray(update) || /"(?:isSuspended|isActive)(?:\.[^"]*)?"/.test(JSON.stringify(update || {}));
  }
  // insertMany/bulkWrite use a shared model as `this`; handle those separately
  // with a stack, since model hooks may run concurrently.
  const modelEnds: Array<() => void> = [];
  for (const op of ["save", "updateOne", "updateMany", "findOneAndUpdate", "replaceOne", "findOneAndReplace", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
    (schema as any).pre(op, function(this: any, next: (e?: Error) => void) {
      if (relevant(this, op)) pending.set(this, beginPublicMutation());
      next();
    });
    (schema as any).post(op, function(this: any, _result: unknown, next: () => void) { pending.get(this)?.(); pending.delete(this); next(); });
    (schema as any).post(op, function(this: any, error: Error, _result: unknown, next: (e: Error) => void) { pending.get(this)?.(); pending.delete(this); next(error); });
  }
  for (const op of ["insertMany", "bulkWrite"]) {
    (schema as any).pre(op, function(next: () => void) { modelEnds.push(beginPublicMutation()); next(); });
    (schema as any).post(op, function(_result: unknown, next: () => void) { modelEnds.pop()?.(); next(); });
    (schema as any).post(op, function(error: Error, _result: unknown, next: (e: Error) => void) { modelEnds.pop()?.(); next(error); });
  }
}
