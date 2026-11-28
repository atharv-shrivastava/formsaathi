import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import AppLocalization from "./components/AppLocalization";
import "./styles.css";
import "./design-system.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppLocalization><App /></AppLocalization>
  </React.StrictMode>
);
