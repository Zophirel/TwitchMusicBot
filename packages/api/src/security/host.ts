import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";

export function hostCheck(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const host = req.headers.host;
    if (!host || !config.allowedHosts.has(host)) {
      return res.status(400).json({ error: "Invalid Host header" });
    }
    return next();
  };
}
