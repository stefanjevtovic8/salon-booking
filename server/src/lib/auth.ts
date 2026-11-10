import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export const COOKIE = "salon_token";
const secret = () => process.env.JWT_SECRET!;
export const signToken = (uid: number, role: string) => jwt.sign({ uid, role }, secret(), { expiresIn: "7d" });

export function requireAuth(q: Request, r: Response, n: NextFunction) {
  try { (q as any).user = jwt.verify(q.cookies?.[COOKIE], secret()); n(); }
  catch { r.status(401).json({ error: "Niste prijavljeni" }); }
}