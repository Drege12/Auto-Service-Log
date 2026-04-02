import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if ("serviceWorker" in navigator) {
  const swUrl = import.meta.env.BASE_URL + "sw.js";
  navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
