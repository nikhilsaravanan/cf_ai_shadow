import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import agents from "agents/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	plugins: [agents(), react(), tailwindcss(), cloudflare()],
});
