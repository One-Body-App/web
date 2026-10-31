import { defineConfig } from 'vitest/config';
import path from 'node:path';
export default defineConfig({
  envDir: false,
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
