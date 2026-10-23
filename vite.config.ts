import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localApiPlugin } from './vite_local_api';

export default defineConfig({
  plugins: [
    react(),
    localApiPlugin()
  ],
  server: {
    watch: {
      ignored: ['**/cpanel_deploy_temp/**', '**/deploy_cpanel.zip', '**/cpanel/**', '**/dist/**', '**/local_db.json']
    }
  },
  build: {
    outDir: 'dist',
    minify: 'esbuild',
    rollupOptions: {
      output: {}
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
});