import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthGate } from "./AuthGate";
import { ToastProvider } from "./Toast";
import "./index.css";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("root element missing");

createRoot(rootEl).render(
	<StrictMode>
		<ToastProvider>
			<AuthGate>
				<App />
			</AuthGate>
		</ToastProvider>
	</StrictMode>,
);
