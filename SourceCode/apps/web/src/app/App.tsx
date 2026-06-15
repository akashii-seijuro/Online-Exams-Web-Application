import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { OfflineIndicator } from "../components/shared/OfflineIndicator";
import { Login } from "../pages/auth/Login";
import { Register } from "../pages/auth/Register";
import { NotFound } from "../pages/NotFound";
import { Play } from "../pages/student/Play";
import { Result } from "../pages/student/Result";
import { StudentRoutes } from "./routes/student/StudentRoutes";
import { ProtectedRoute } from "./routes/teacher/ProtectedRoute";
import { TeacherRoutes } from "./routes/teacher/TeacherRoutes";

export function App() {
  return (
    <>
      <OfflineIndicator />
      <Toaster richColors position="top-right" />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/join/*" element={<StudentRoutes />} />
        <Route path="/play/:sessionId" element={<Play />} />
        <Route path="/play/:sessionId/result" element={<Result />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard/*" element={<TeacherRoutes />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
