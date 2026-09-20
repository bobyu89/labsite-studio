import React from "react";
import { createRoot } from "react-dom/client";
import { Theme } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";
import App from "./App.jsx";
import "./styles.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Theme
      accentColor="teal"
      grayColor="slate"
      radius="medium"
      appearance="light"
    >
      <App />
    </Theme>
  </React.StrictMode>,
);
