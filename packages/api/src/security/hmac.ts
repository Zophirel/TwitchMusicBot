import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import { safeEqual } from "../utils/crypto.js";

export function verifyBotSignature(sharedSecret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const tsHeader = req.header("x-bot-ts");
    const sigHeader = req.header("x-bot-sig");

    if (!tsHeader || !sigHeader) {
      return res.status(401).json({ error: "Missing bot signature" });
    }

    const ts = Number(tsHeader);
    if (!Number.isFinite(ts)) {
      return res.status(401).json({ error: "Invalid timestamp" });
    }

    const ageMs = Math.abs(Date.now() - ts);
    if (ageMs > 30_000) {
      return res.status(401).json({ error: "Expired timestamp" });
    }

    const rawBody = req.rawBody ?? "";
    const expected = crypto
      .createHmac("sha256", sharedSecret)
      .update(`${tsHeader}.${rawBody}`)
      .digest("hex");

    if (!safeEqual(expected, sigHeader)) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    return next();
  };
}
