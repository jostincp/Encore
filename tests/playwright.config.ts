/**
 * Encore Platform - Playwright Configuration
 * Configuración completa para pruebas end-to-end
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Configuración básica
  testDir: './e2e',
  outputDir: './test-results',
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  // Configuración de ejecución
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // Configuración de reporter
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['github']
  ],

  // Configuración de uso compartido
  use: {
    // Configuración base por test
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Configuración de contexto
    contextOptions: {
      permissions: ['geolocation'],
      geolocation: { latitude: 4.6097, longitude: -74.0817 }, // Bogotá
      locale: 'es-CO',
      timezoneId: 'America/Bogota'
    }
  },

  // Configuración de proyectos (diferentes navegadores/dispositivos)
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Dispositivos móviles
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    // Tablets
    {
      name: 'Tablet',
      use: { ...devices['iPad Pro'] },
    },

    // Modo de accesibilidad
    {
      name: 'accessibility',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--enable-accessibility-tab-switcher']
        }
      },
      testMatch: '**/accessibility.test.ts',
    },

    // Pruebas de performance
    {
      name: 'performance',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        }
      },
      testMatch: '**/performance.test.ts',
    },

    // Pruebas de API (usando Playwright como cliente HTTP)
    {
      name: 'api',
      use: {
        baseURL: process.env.API_BASE_URL || 'http://localhost:3001',
        extraHTTPHeaders: {
          'Content-Type': 'application/json',
          'X-Test-Environment': 'e2e'
        }
      },
      testMatch: '**/api.test.ts',
    }
  ],

  // Configuración de servidor de desarrollo
  webServer: [
    {
      command: 'cd frontend && npm run dev',
      port: 3000,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd backend/auth-service && npm run dev',
      port: 3001,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd backend/music-service && npm run dev',
      port: 3002,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd backend/queue-service && npm run dev',
      port: 3003,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd backend/points-service && npm run dev',
      port: 3004,
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    }
  ],

  // Configuración global de setup/teardown
  globalSetup: require.resolve('./setup/global-setup'),
  globalTeardown: require.resolve('./setup/global-teardown'),

  // Configuración de metadata
  metadata: {
    platform: process.platform,
    nodeVersion: process.version,
    testEnvironment: process.env.NODE_ENV || 'development',
    baseURL: process.env.BASE_URL || 'http://localhost:3000'
  }
});