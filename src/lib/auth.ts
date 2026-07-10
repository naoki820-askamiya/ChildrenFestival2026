import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/lib/types";

const COOKIE_NAME = "children-festival-session";

function secret() {
  return new TextEncoder().encode(
    process.env.SESSION_SECRET || "development-only-secret-change-before-deploy",
  );
}

export function passwordFor(role: Role) {
  const names: Record<Role, string> = {
    writer: "WRITER_PASSWORD",
    viewer: "VIEWER_PASSWORD",
    display214: "DISPLAY_214_PASSWORD",
    display215: "DISPLAY_215_PASSWORD",
  };
  return process.env[names[role]];
}

export async function createSession(role: Role) {
  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getRole(): Promise<Role | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role as Role;
    return ["writer", "viewer", "display214", "display215"].includes(role)
      ? role
      : null;
  } catch {
    return null;
  }
}

