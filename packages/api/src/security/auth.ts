import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { safeEqual } from "../utils/crypto.js";

export const ADMIN_COOKIE_NAME = "admin_token";

export function issueAdminToken(res: Response, secret: string) {
  const token = jwt.sign({ sub: "admin" }, secret, { expiresIn: "12h" });
  res.cookie(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: false,
    path: "/"
  });
}

export function clearAdminToken(res: Response) {
  res.clearCookie(ADMIN_COOKIE_NAME, { path: "/" });
}

export function verifyAdminPassword(input: string, expected: string) {
  return safeEqual(input, expected);
}

export function requireAdmin(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies?.[ADMIN_COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const payload = jwt.verify(token, secret);
      if (typeof payload !== "object" || payload === null) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      return next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  };
}
