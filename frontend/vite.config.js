import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // The production build is collected into Django's STATIC_ROOT and served
  // by WhiteNoise under /static/ (see STATICFILES_DIRS in settings.py), so
  // asset URLs must be /static/... . The dev server keeps the root base, so
  // the local `npm run dev` workflow is unchanged.
  base: mode === 'production' ? '/static/' : '/',
}))
