import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    strictPort: true,
    fs: {
      deny: [".env", ".env.*", "*.{crt,pem,key,p12,pfx,cer,der}", ".npmrc", ".yarnrc.yml", "**/.git/**", "**/backend/**"],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        configure(proxy) {
          proxy.on("proxyReq", (proxyReq, req) => {
            proxyReq.setHeader("X-Forwarded-For", req.socket.remoteAddress);
            proxyReq.setHeader("X-Forwarded-Proto", "http");
          });
        },
      },
    },
  },
});
