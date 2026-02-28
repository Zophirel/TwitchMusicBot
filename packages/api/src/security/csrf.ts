import type { NextFunction, Request, Response } from "express";
import { randomToken, safeEqual } from "../utils/crypto.js";

export const CSRF_COOKIE_NAME = "csrf_token";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function ensureCsrfCookie(req: Request, res: Response, next: NextFunction) {
  if (!req.cookies?.[CSRF_COOKIE_NAME]) {
    res.cookie(CSRF_COOKIE_NAME, randomToken(32), {
      httpOnly: false,
      sameSite: "strict",
      secure: false,
      path: "/"
    });
  }
  return next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.header(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: "CSRF token missing" });
  }
  if (!safeEqual(cookieToken, headerToken)) {
    return res.status(403).json({ error: "CSRF token invalid" });
  }
  return next();
}
