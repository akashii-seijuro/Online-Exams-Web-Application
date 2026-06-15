import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { AppError } from "./error.middleware.js";
import { verifyAccessToken } from "../utils/jwt.js";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: "TEACHER" | "ADMIN";
};

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

type MaybeAuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};

function getBearerToken(req: Request) {
  const authorization = req.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục", 401);
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new AppError("UNAUTHORIZED", "Bạn cần đăng nhập để tiếp tục", 401);
  }

  return token;
}

function authenticateRequest(req: MaybeAuthenticatedRequest) {
  const token = getBearerToken(req);

  try {
    const payload = verifyAccessToken(token);
    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };

    req.user = user;
    return user;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AppError("TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn", 401);
    }

    throw new AppError("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ", 401);
  }
}

export function requireAuth(req: MaybeAuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    authenticateRequest(req);
    next();
  } catch (error) {
    next(error);
  }
}

export function requireTeacher(req: MaybeAuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    const user = req.user ?? authenticateRequest(req);

    if (user.role !== "TEACHER") {
      next(new AppError("FORBIDDEN", "Bạn không có quyền truy cập tài nguyên này", 403));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
