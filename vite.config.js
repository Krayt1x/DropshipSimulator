import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { version } from './package.json';

function commitInfo() {
  try {
    const hash = execSync('git log -1 --format=%h').toString().trim();
    const date = execSync('git log -1 --format=%cI').toString().trim();
    return { hash, date };
  } catch {
    return { hash: 'unknown', date: null };
  }
}

const { hash, date } = commitInfo();

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __COMMIT_HASH__: JSON.stringify(hash),
    __COMMIT_DATE__: JSON.stringify(date),
  },
  test: {
    environment: 'jsdom',
  },
});
