import { defineConfig } from 'astro/config';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  output: 'static',
  outDir: 'dist',
  srcDir: 'src',
  site: 'https://pesquisatabelafipe.com.br',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  vite: {
    resolve: {
      alias: {
        '@root': path.resolve(root, '..'),
      },
    },
  },
});
