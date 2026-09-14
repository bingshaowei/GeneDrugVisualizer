import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiProxy = {
  target: 'http://127.0.0.1:5000',
  changeOrigin: false,
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '^/(health|genes|expression|autocomplete|drug_group_summary|drug_response|drug_details|cell_line_map)': apiProxy,
    },
  },
  build: {
    outDir: 'build',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
