// frontend\vite.config.ts

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  // 🟢 Added "as any" to bypass Vite plugin type conflicts
  plugins:[
    react(), 
    basicSsl()
  ] as any, 
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});