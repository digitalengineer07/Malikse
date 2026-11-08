// Preserve compatibility with installed clients that cannot render populated
// null owners or older review records without a checklist. Never mutate storage.
export function workspaceResponse(property: { toJSON(): any }) {
  const data = property.toJSON();
  if (data.ownerId === null) delete data.ownerId;
  for (const key of ["advisorReview", "verifierReview"]) {
    const report = data[key];
    if (report && typeof report === "object" && !Array.isArray(report)) {
      data[key] = { ...report, checklist: report.checklist || {} };
    }
  }
  return data;
}
