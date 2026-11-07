import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/geist";
import "@xyflow/react/dist/base.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/nodes.css";
import "./styles/areas.css";
import "./styles/faces.css";
import "./styles/chrome.css";
import "./styles/focus.css";
import "./styles/live.css";
import "./styles/source.css";
import "./styles/project-files.css";
import "./styles/video.css";
import "./styles/docs.css";
import "./styles/project.css";
import "./styles/home.css";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
