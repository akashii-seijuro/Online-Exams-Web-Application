import { Route, Routes } from "react-router-dom";

import { NotFound } from "../../../pages/NotFound";
import { Join } from "../../../pages/student/Join";

export function StudentRoutes() {
  return (
    <Routes>
      <Route index element={<Join />} />
      <Route path=":code" element={<Join />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
