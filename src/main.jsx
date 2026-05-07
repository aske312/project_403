import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import AuthPage from "./pages/AuthPage";
import WorkspacePage from "./pages/WorkspacePage";
import Admin from "./pages/Admin";
import { markFrontendReady } from "./utils/performanceMetrics";

const router = createBrowserRouter([
  {
    path: "/",
    element: <WorkspacePage />,
  },
  {
    path: "/auth",
    element: <AuthPage />,
  },
  {
    path: "/admin",
    element: <Admin />,
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

requestAnimationFrame(markFrontendReady);
