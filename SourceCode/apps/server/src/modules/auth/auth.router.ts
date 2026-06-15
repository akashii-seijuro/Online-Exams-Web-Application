import { Router, type NextFunction, type Request, type Response } from "express";

import { requireAuth, type AuthenticatedRequest } from "../../shared/middleware/auth.middleware.js";
import { authServiceStatus, getCurrentTeacher, loginTeacher, registerTeacher } from "./auth.service.js";
import { loginSchema, registerSchema } from "./auth.schema.js";

export const authRouter = Router();

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

authRouter.get("/status", (_req, res) => {
  res.json({ success: true, data: authServiceStatus() });
});

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const result = await registerTeacher(registerSchema.parse(req.body));

    res.status(201).json({
      success: true,
      data: result
    });
  })
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const result = await loginTeacher(loginSchema.parse(req.body));

    res.json({
      success: true,
      data: result
    });
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const authenticatedReq = req as AuthenticatedRequest;
    const user = await getCurrentTeacher(authenticatedReq.user.id);

    res.json({
      success: true,
      data: { user }
    });
  })
);
