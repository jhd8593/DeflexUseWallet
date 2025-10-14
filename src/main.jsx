import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";
import { Buffer } from "buffer";
import process from "process";

if (typeof window !== "undefined") {
  if (!window.Buffer) {
    window.Buffer = Buffer;
  }
  if (!window.process) {
    window.process = process;
  }
  if (!window.global) {
    window.global = window;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
