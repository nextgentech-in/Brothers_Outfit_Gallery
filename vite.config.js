import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const publicKeys = [
  'VITE_BACKEND_URL',
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_APP_ID',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_ADMIN_EMAIL'
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    envPrefix: [],
    define: Object.fromEntries(publicKeys.map(key => ['import.meta.env.' + key, JSON.stringify(env[key] || '')])),
    plugins: [react()],
    server: {
      watch: {
        ignored: ['**/.chrome-preview*/**', '**/.edge-preview/**']
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true
        }
      }
    },
    build: {
      // Target modern browsers for smaller, faster output
      target: ['es2020', 'chrome87', 'firefox78', 'safari14'],
      // Disable source maps in production (security + smaller output)
      sourcemap: false,
      // Use Vite 8 default OXC minifier (esbuild is deprecated/separate)
      cssMinify: true,
      rollupOptions: {
        output: {
          // Granular chunk splitting for optimal caching & parallel loading
          manualChunks(id) {
            if (id.includes('node_modules')) {
              // Firebase split by sub-package for max caching granularity
              if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) {
                return 'vendor-firestore';
              }
              if (id.includes('@firebase/auth') || id.includes('firebase/auth')) {
                return 'vendor-auth';
              }
              if (id.includes('@firebase/storage') || id.includes('firebase/storage')) {
                return 'vendor-storage';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase-core';
              }
              // React ecosystem
              if (id.includes('react-router-dom') || id.includes('@remix-run')) {
                return 'vendor-router';
              }
              if (id.includes('react-dom')) {
                return 'vendor-react-dom';
              }
              if (id.includes('react')) {
                return 'vendor-react';
              }
              // Analytics (smallest, separate chunk so it never blocks main)
              if (id.includes('@vercel/analytics')) {
                return 'vendor-analytics';
              }
            }
          },
          // Ensure assets are hashed for immutable caching
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        }
      },
      // Raise threshold — Firebase is legitimately large; we've split it above
      chunkSizeWarningLimit: 700
    }
  };
});
