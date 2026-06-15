import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "../../config/env.js";

export type TeacherRole = "TEACHER" | "ADMIN";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: TeacherRole;
};

export type ParticipantTokenPayload = {
  type: "participant";
  sub: string;
  sessionId: string;
  name: string;
};

function isAccessTokenPayload(payload: string | JwtPayload): payload is JwtPayload & AccessTokenPayload {
  return (
    typeof payload !== "string" &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    (payload.role === "TEACHER" || payload.role === "ADMIN")
  );
}

function isParticipantTokenPayload(
  payload: string | JwtPayload
): payload is JwtPayload & ParticipantTokenPayload {
  return (
    typeof payload !== "string" &&
    payload.type === "participant" &&
    typeof payload.sub === "string" &&
    typeof payload.sessionId === "string" &&
    typeof payload.name === "string"
  );
}

export function signAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "45m" });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (!isAccessTokenPayload(payload)) {
    throw new Error("Invalid access token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role
  };
}

export function signParticipantToken(payload: ParticipantTokenPayload) {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "4h" });
}

export function verifyParticipantToken(token: string): ParticipantTokenPayload {
  const payload = jwt.verify(token, env.JWT_SECRET);

  if (!isParticipantTokenPayload(payload)) {
    throw new Error("Invalid participant token payload");
  }

  return {
    type: "participant",
    sub: payload.sub,
    sessionId: payload.sessionId,
    name: payload.name
  };
}
