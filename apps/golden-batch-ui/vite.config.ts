import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path"

export default defineConfig(({ mode }) => {
  // Explicitly load env variables from the workspace root
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      'import.meta.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
      'import.meta.env.OPENROUTER_BASE_URL': JSON.stringify(env.OPENROUTER_BASE_URL),
      'import.meta.env.OPENROUTER_MODEL': JSON.stringify(env.OPENROUTER_MODEL),
    }
  };
})
