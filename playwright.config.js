import { defineConfig } from '@playwright/test';

// Each spec launches its own persistent context with the unpacked extension
// loaded, so there is no shared browser project here.
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
});
