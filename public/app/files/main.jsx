import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ViewFilesApp } from "./ViewFilesApp";
import "../../styles.css";
import "../../view-files.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ViewFilesApp />
  </StrictMode>
);
