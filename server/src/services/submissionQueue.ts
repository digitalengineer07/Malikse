import { createHash, randomUUID } from "crypto";
import { Property, IProperty } from "../models/Property.model";
import { User } from "../models/User.model";
import { availableStaff, historyEvent, listingFields, transition, validateListing } from "./propertyWorkflow";

const maxAttempts = 5;
const leaseMs = 60_000;

// The job and immutable submitted details live in the same document. Accepting a
// submission and persisting its job therefore cannot be separated by a crash.
export async function enqueueSubmission(property: IProperty, actor: { id: string; role: string }) {
  const digest = createHash("sha256").update(JSON.stringify(listingFields(property.toObject()))).digest("hex");
  return transition(property, {
    status: "queued",
    submission: { id: randomUUID(), digest, attempts: 0, nextAttemptAt: new Date() },
  }, historyEvent(actor, property.status, "queued", "submission_queued", { consent: true, digest }));
}

export async function processNextSubmission(): Promise<boolean> {
  const now = new Date();
  const leaseToken = randomUUID();
  const property = await Property.findOneAndUpdate({
    status: "queued", "submission.nextAttemptAt": { $lte: now },
    $or: [{ "submission.leaseUntil": { $exists: false } }, { "submission.leaseUntil": { $lte: now } }],
  }, {
    $set: { "submission.leaseUntil": new Date(now.getTime() + leaseMs), "submission.leaseToken": leaseToken },
    $inc: { "submission.attempts": 1 },
  }, { new: true, sort: { "submission.nextAttemptAt": 1, _id: 1 } });
  if (!property) return false;
  const filter = { _id: property._id, status: "queued", "submission.leaseToken": leaseToken };
  try {
    if (property.submission!.attempts > maxAttempts) throw new Error("Submission processing failed repeatedly. Please submit again.");
    const seller = await User.findById(property.ownerId);
    if (!seller || seller.isActive === false || seller.isSuspended || !seller.demoKycComplete) throw new Error("Your account must be active with demo KYC complete before submitting.");
    const invalid = validateListing(property);
    if (invalid) throw new Error(invalid);
    const advisorId = await availableStaff("advisor", property.assignedAdvisorId);
    await Property.updateOne(filter, {
      $set: { status: "pending", assignedAdvisorId: advisorId || null, assignedVerifierId: null,
        advisorReview: null, verifierReview: null, rejectionReason: "",
        badges: { identityVerified: false, documentsChecked: false, siteVisited: false, lawyerReviewed: false, fullyVerified: false },
        "submission.completedAt": new Date(), "submission.error": "" },
      $unset: { "submission.leaseToken": 1, "submission.leaseUntil": 1 },
      $inc: { __v: 1 },
      $push: { verificationHistory: historyEvent({ id: property.ownerId.toString(), role: "user" }, "queued", "pending", "submitted", { assignedAdvisorId: advisorId, consent: true, submissionId: property.submission!.id }) },
    });
  } catch (error) {
    const exhausted = property.submission!.attempts >= maxAttempts;
    const message = "Submission could not be processed. Check your account and listing, then submit again.";
    await Property.updateOne(filter, {
      $set: { ...(exhausted ? { status: "correction_required", rejectionReason: message } : {}),
        "submission.error": message,
        "submission.nextAttemptAt": new Date(Date.now() + 1000 * 2 ** property.submission!.attempts + Math.floor(Math.random() * 1000)) },
      $unset: { "submission.leaseToken": 1, "submission.leaseUntil": 1 },
      $inc: { __v: 1 },
      ...(exhausted ? { $push: { verificationHistory: historyEvent({ id: property.ownerId.toString(), role: "user" }, "queued", "correction_required", "submission_failed") } } : {}),
    });
    console.error("[submission-worker] Attempt failed", { propertyId: String(property._id), attempt: property.submission!.attempts });
  }
  return true;
}

// One bounded worker per process; atomic expiring leases also permit standalone
// workers and multiple API replicas. Shutdown waits for the current job.
export function startSubmissionWorker() {
  let stopped = false;
  let running: Promise<void> | undefined;
  const tick = () => {
    if (stopped || running) return;
    let processed = 0;
    running = (async () => {
      for (let i = 0; i < 10 && !stopped; i++) {
        if (!await processNextSubmission()) break;
        processed++;
      }
    })().catch(() => console.error("[submission-worker] Database unavailable; retrying on next poll"))
      .finally(() => { running = undefined; if (processed === 10 && !stopped) setImmediate(tick); });
  };
  const timer = setInterval(tick, 1000);
  tick();
  return async () => { stopped = true; clearInterval(timer); await running; };
}
