import jwt from "jsonwebtoken";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "dt-fallback-secret-change-me-in-production";
const EXPIRES_IN = "30d";

export interface JwtPayload {
  mechanicId: number;
  iat?: number;
  exp?: number;
}

export function signToken(mechanicId: number): string {
  return jwt.sign({ mechanicId } as JwtPayload, JWT_SECRET, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  return token || null;
}
