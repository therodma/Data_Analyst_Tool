import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Data_Cleaning_Tool/',
  server: { port: 3000 },
})
