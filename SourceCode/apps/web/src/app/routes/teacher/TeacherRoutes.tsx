import { Route, Routes } from "react-router-dom";

import { TeacherLayout } from "../../../components/teacher/TeacherLayout";
import { NotFound } from "../../../pages/NotFound";
import { Dashboard } from "../../../pages/teacher/Dashboard";
import { LiveMonitor } from "../../../pages/teacher/LiveMonitor";
import { QuizBuilder } from "../../../pages/teacher/QuizBuilder";
import { Quizzes } from "../../../pages/teacher/Quizzes";
import { Report } from "../../../pages/teacher/Report";
import { SessionLobby } from "../../../pages/teacher/SessionLobby";
import { Sessions } from "../../../pages/teacher/Sessions";

export function TeacherRoutes() {
  return (
    <Routes>
      <Route element={<TeacherLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="quizzes" element={<Quizzes />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="quiz/new" element={<QuizBuilder />} />
        <Route path="quiz/:quizId/edit" element={<QuizBuilder />} />
        <Route path="session/:sessionId/lobby" element={<SessionLobby />} />
        <Route path="session/:sessionId/live" element={<LiveMonitor />} />
        <Route path="session/:sessionId/report" element={<Report />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
