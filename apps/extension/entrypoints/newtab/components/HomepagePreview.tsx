import { SandpackLayout, SandpackPreview, SandpackProvider } from "@codesandbox/sandpack-react";
import { useEffect } from "react";

const NAVIGATE_MESSAGE = "homepage:navigate";

// Most sites refuse to be framed (X-Frame-Options / frame-ancestors), so a link
// followed inside the sandbox fails with ERR_BLOCKED_BY_RESPONSE. Intercept link
// clicks and hand the URL to the new-tab page, which navigates for real.
const INDEX_JS = `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

function forwardLink(event) {
  if (event.defaultPrevented || (event.type === "click" && event.button !== 0)) return;
  if (event.type === "auxclick" && event.button !== 1) return;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!anchor || !/^https?:$/.test(anchor.protocol)) return;
  event.preventDefault();
  const newTab =
    event.type === "auxclick" || event.metaKey || event.ctrlKey || event.shiftKey ||
    anchor.target === "_blank";
  window.parent.postMessage({ type: "${NAVIGATE_MESSAGE}", url: anchor.href, newTab }, "*");
}
document.addEventListener("click", forwardLink);
document.addEventListener("auxclick", forwardLink);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);`;

const INDEX_HTML = `<!DOCTYPE html>
<html><head><title>My Personalized Homepage</title></head>
<body><div id="root"></div></body></html>`;

/**
 * Renders the agent's component in a Sandpack iframe. The code is
 * model-generated, so it runs sandboxed rather than in the extension's own page.
 */
export function HomepagePreview({ code }: { code: string }) {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.type !== NAVIGATE_MESSAGE || typeof data.url !== "string") return;
      let url: URL;
      try {
        url = new URL(data.url);
      } catch {
        return;
      }
      // The sender is model-generated code: only ever follow plain web links.
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      if (data.newTab) void browser.tabs.create({ url: url.href, active: false });
      else window.location.assign(url.href);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const files = {
    "/App.js": { code },
    "/index.js": { code: INDEX_JS },
    "/index.html": { code: INDEX_HTML },
  };

  return (
    <SandpackProvider files={files} template="react" options={{ autorun: true }}>
      <SandpackLayout style={{ height: "100vh", width: "100vw" }}>
        <SandpackPreview style={{ height: "100%" }} />
      </SandpackLayout>
    </SandpackProvider>
  );
}
