import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Backend runs on :8765 (uvicorn). In dev, Vite proxies the WebSocket.
export default defineConfig({
  plugins: [react()],
})
