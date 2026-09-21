import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// GitHub Pages project site: https://mhbesharatnia.github.io/bahesab/
const base = process.env.GITHUB_PAGES === '1' ? '/bahesab/' : '/'

export default defineConfig({
  plugins: [react()],
  base,
})
