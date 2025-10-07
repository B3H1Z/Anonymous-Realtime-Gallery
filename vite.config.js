import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Plugin to replace GA_MEASUREMENT_ID in HTML
const replaceGAId = () => {
  return {
    name: 'replace-ga-id',
    transformIndexHtml(html) {
      const gaId = process.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX'
      return html.replace(/%VITE_GA_MEASUREMENT_ID%/g, gaId)
    }
  }
}

export default defineConfig({
  plugins: [react(), replaceGAId()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/images': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react']
        }
      }
    }
  }
})