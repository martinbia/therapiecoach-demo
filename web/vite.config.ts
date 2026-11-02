import { defineConfig, loadEnv } from 'vite';

// Github Pages: VITE_BASE_PATH=/repository-name/ ; custom domain: /
export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: env.VITE_BASE_PATH || '/',
    build: {target: 'es2022', outDir: 'dist'},
    server: {host: '0.0.0.0'},
  };
});
