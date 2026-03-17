import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    assetsInlineLimit: 0,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'LexicalPlayground',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format}.js`,
    },

    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJSXRuntime',
        },
      },
    },
    sourcemap: false,
    // Reduce noise in output
    chunkSizeWarningLimit: 2000,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
});
