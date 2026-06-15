import { Router } from "express";

import { requireTeacher, type AuthenticatedRequest } from "../../shared/middleware/auth.middleware.js";
import { getTeacherSessionReport } from "./reports.service.js";
import { reportSessionParamsSchema } from "./reports.schema.js";

export const reportsRouter = Router();

reportsRouter.use(requireTeacher);

reportsRouter.get("/sessions/:sessionId", async (req, res, next) => {
  try {
    const params = reportSessionParamsSchema.parse(req.params);
    const { user } = req as unknown as AuthenticatedRequest;
    const data = await getTeacherSessionReport(params.sessionId, user.id);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
});
