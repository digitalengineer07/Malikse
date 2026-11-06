export interface PublicSnapshot {
  body: Buffer; gzip?: Buffer; br?: Buffer; nextCursor: string; status: number;
  expires: number; localUntil: number; bytes: number;
}
// Only public allowlisted, serialized DTOs. Mutation hooks invalidate the generation.
export const searchMemory = new Map<string, PublicSnapshot>();
