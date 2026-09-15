import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import MicrositeApp from "./components/microsite/MicrositeApp.jsx";
import { getDealerSubdomain } from "./lib/subdomain.js";
import "./styles/index.css";

// If this page was loaded on a dealer's own subdomain (e.g.
// primemotors.trustdrive.in, or primemotors.localhost for local testing),
// render just their microsite -- not the full TrustDrive app/router.
const dealerSubdomain = getDealerSubdomain();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {dealerSubdomain ? (
      <MicrositeApp subdomain={dealerSubdomain} />
    ) : (
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    )}
  </React.StrictMode>
);
