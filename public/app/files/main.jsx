import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ManageFilesApp } from "./ManageFilesApp";
import "../../styles.css";
import "../../manage-files.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ManageFilesApp />
  </StrictMode>
);
