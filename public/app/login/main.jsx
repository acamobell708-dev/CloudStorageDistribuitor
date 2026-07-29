import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LoginApp } from "./LoginApp";
import "../../styles.css";
import "../../login.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <LoginApp />
  </StrictMode>
);
