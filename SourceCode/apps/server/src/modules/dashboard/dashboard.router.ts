import { Router, type NextFunction, type Request, type Response } from "express";

import { requireTeacher, type AuthenticatedRequest } from "../../shared/middleware/auth.middleware.js";
import { getTeacherDashboardSummary } from "./dashboard.service.js";

export const dashboardRouter = Router();

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function getTeacherId(req: Request) {
  return (req as AuthenticatedRequest).user.id;
}

dashboardRouter.use(requireTeacher);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const summary = await getTeacherDashboardSummary(getTeacherId(req));

    res.json({
      success: true,
      data: { summary }
    });
  })
);
