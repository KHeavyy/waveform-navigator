import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Build worker separately
  if (mode === 'worker') {
    return {
      build: {
        lib: {
          entry: resolve(__dirname, 'src/peaks.worker.ts'),
          formats: ['es'],
          fileName: () => 'peaks.worker.js'
        },
        outDir: 'dist',
        emptyOutDir: false,
        sourcemap: true
      }
    }
  }

  // Main library build
  return {
    plugins: [
      react(),
      dts({
        include: ['src/**/*'],
        exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/peaks.worker.ts'],
        rollupTypes: true, // Bundle type declarations into a single file
      })
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'WaveformNavigator',
        formats: ['es', 'cjs'],
        fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
      },
      rollupOptions: {
        // Externalize React dependencies
        external: ['react', 'react-dom', 'react/jsx-runtime'],
        output: {
          // Preserve module structure for better tree-shaking
          preserveModules: false,
          // Assets will be emitted to the dist root
          assetFileNames: (assetInfo) => {
            if (assetInfo.name === 'style.css') return 'styles.css'
            return assetInfo.name || '[name][extname]'
          }
        }
      },
      // Generate source maps for easier debugging
      sourcemap: true,
      // Clear output directory before building
      emptyOutDir: true
    },
    // Optimize dependencies
    optimizeDeps: {
      exclude: ['react', 'react-dom']
    }
  }
})
