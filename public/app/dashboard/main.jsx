import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthSessionProvider } from "../auth/AuthSessionProvider";
import { DashboardApp } from "./DashboardApp";
import "../../styles.css";
import "../../dashboard.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthSessionProvider>
      <DashboardApp />
    </AuthSessionProvider>
  </StrictMode>
);
