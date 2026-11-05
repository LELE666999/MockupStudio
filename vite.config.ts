import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {workspacePlugin} from './server/workspace.mjs';

export default defineConfig(({ mode }) => {
    return {
      // Relative URLs support both / and /<GitHub repository>/.
      base: './',
      server: {
        port: 3000,
        host: '127.0.0.1',
      },
      plugins: [react(), tailwindcss(),workspacePlugin(__dirname)],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
