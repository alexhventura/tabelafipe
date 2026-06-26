import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import { buildInlineVehicleShellScriptTag } from './src/lib/inlineVehicleShellScript';

function inlineVehicleShellPlugin(): Plugin {
  return {
    name: 'inline-vehicle-shell',
    transformIndexHtml(html) {
      const tag = buildInlineVehicleShellScriptTag();
      if (html.includes('inline-vehicle-shell')) return html;
      return html.replace('<script type="module"', `${tag}\n    <script type="module"`);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), inlineVehicleShellPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('recharts')) return 'vendor-charts';
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('/react/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) return 'vendor-icons';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/fipe': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/api/health': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
