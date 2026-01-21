import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/**/*'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      rollupTypes: true, // Bundle type declarations into a single file
    }),
    // Copy the worker source file to dist for consumers who need to host it separately
    viteStaticCopy({
      targets: [
        {
          src: 'src/peaks.worker.ts',
          dest: '.',
          rename: 'peaks.worker.js'
        }
      ]
    })
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'WaveformNavigator',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    rollupOptions: {
      // Externalize React dependencies
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        // Provide global variables for UMD build (not used here but good practice)
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'react/jsx-runtime'
        },
        // Preserve module structure for better tree-shaking
        preserveModules: false,
        // Assets will be emitted to the dist root
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'styles.css'
          return assetInfo.name || 'asset'
        }
      }
    },
    // Generate source maps for easier debugging
    sourcemap: true,
    // Clear output directory before building
    emptyOutDir: true
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'peaks.worker.js',
      }
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    exclude: ['react', 'react-dom']
  }
})
