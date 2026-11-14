import { hash, verify } from "@node-rs/argon2";
import { createHmac, timingSafeEqual } from "node:crypto";

const ARGON_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 3,
  parallelism: 1,
  outputLen: 32
};

export async function hashTreeAccessCode(value: string) {
  return hash(value, ARGON_OPTIONS);
}

export async function verifyTreeAccessCode(hashValue: string, candidate: string) {
  if (!hashValue || !candidate) return false;
  try {
    return await verify(hashValue, candidate, ARGON_OPTIONS);
  } catch {
    return false;
  }
}

export function verifyTreeAccessCookie(treeId: string, value?: string) {
  const secret = process.env.TREE_ACCESS_COOKIE_SECRET;
  if (!secret || secret.length < 32 || !value) return false;
  const [expiresValue, signature] = value.split(".");
  const expires = Number(expiresValue);
  if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000) || !signature) return false;
  const expected = createHmac("sha256", secret).update(`${treeId}.${expires}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}
