import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthSessionProvider } from "../auth/AuthSessionProvider";
import { permissions } from "../auth/permissions";
import { ManageFilesApp } from "./ManageFilesApp";
import "../../styles.css";
import "../../manage-files.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthSessionProvider requiredPermission={permissions.listFiles}>
      <ManageFilesApp />
    </AuthSessionProvider>
  </StrictMode>
);
