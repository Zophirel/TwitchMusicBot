import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";

function isAllowedReferer(referer: string, allowedOrigins: Set<string>) {
  for (const origin of allowedOrigins) {
    if (referer.startsWith(`${origin}/`) || referer === origin) {
      return true;
    }
  }
  return false;
}

export function requireOrigin(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const referer = req.headers.referer;

    if (origin) {
      if (!config.allowedOrigins.has(origin)) {
        return res.status(403).json({ error: "Origin not allowed" });
      }
      return next();
    }

    if (referer) {
      if (!isAllowedReferer(referer, config.allowedOrigins)) {
        return res.status(403).json({ error: "Referer not allowed" });
      }
      return next();
    }

    return res.status(403).json({ error: "Origin required" });
  };
}
