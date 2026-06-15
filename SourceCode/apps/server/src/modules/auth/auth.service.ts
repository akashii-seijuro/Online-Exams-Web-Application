import bcrypt from "bcrypt";
import type { UserRole } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "../../config/database.js";
import { AppError } from "../../shared/middleware/error.middleware.js";
import { signAccessToken } from "../../shared/utils/jwt.js";
import type { LoginInput, RegisterInput } from "./auth.schema.js";

const PASSWORD_SALT_ROUNDS = 12;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

export type AuthResult = {
  user: PublicUser;
  accessToken: string;
};

function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role
  };
}

function createAuthResult(user: PublicUser): AuthResult {
  return {
    user: toPublicUser(user),
    accessToken: signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role
    })
  };
}

export async function registerTeacher(input: RegisterInput): Promise<AuthResult> {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true }
  });

  if (existingUser) {
    throw new AppError("EMAIL_ALREADY_EXISTS", "Email này đã được đăng ký", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

  try {
    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
        role: "TEACHER"
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true
      }
    });

    return createAuthResult(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError("EMAIL_ALREADY_EXISTS", "Email này đã được đăng ký", 409);
    }

    throw error;
  }
}

export async function loginTeacher(input: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      passwordHash: true
    }
  });

  if (!user) {
    throw new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng", 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError("INVALID_CREDENTIALS", "Email hoặc mật khẩu không đúng", 401);
  }

  return createAuthResult(user);
}

export async function getCurrentTeacher(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });

  if (!user) {
    throw new AppError("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ", 401);
  }

  return toPublicUser(user);
}

export function authServiceStatus() {
  return { module: "auth", status: "ready" };
}
