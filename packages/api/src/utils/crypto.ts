import crypto from "node:crypto";

export function safeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}
