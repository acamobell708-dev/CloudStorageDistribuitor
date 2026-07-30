import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthSessionProvider } from "../auth/AuthSessionProvider";
import { permissions } from "../auth/permissions";
import { AvailableStorageApp } from "./AvailableStorageApp";
import "../../styles.css";
import "../../available-storage.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthSessionProvider requiredPermission={permissions.listFiles}>
      <AvailableStorageApp />
    </AuthSessionProvider>
  </StrictMode>
);
