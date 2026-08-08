import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // GitHub Pages serves project sites at username.github.io/repo-name/,
  // so assets need this prefix. Change 'outage-tracker' to your actual
  // repo name (or set to '/' if using a username.github.io repo or a
  // custom domain).
  base: '/Power_Outage_Tracker/',
});
