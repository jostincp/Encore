/**
 * Encore Platform - Jest Configuration
 * Configuración completa de Jest para testing unitario, integración y e2e
 */

module.exports = {
  // Configuración básica
  testEnvironment: 'node',
  rootDir: '../',
  testMatch: [
    '<rootDir>/backend/*/tests/**/*.test.js',
    '<rootDir>/backend/*/tests/**/*.test.ts',
    '<rootDir>/frontend/src/**/*.test.js',
    '<rootDir>/frontend/src/**/*.test.tsx',
    '<rootDir>/shared/**/*.test.js',
    '<rootDir>/shared/**/*.test.ts'
  ],

  // Transformaciones
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest',
    '^.+\\.(vue)$': ['vue-jest', {
      babelConfig: false
    }]
  },

  // Módulos
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'vue', 'node'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/frontend/src/$1',
    '^@encore/(.*)$': '<rootDir>/backend/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },

  // Cobertura
  collectCoverageFrom: [
    'backend/*/src/**/*.{js,ts}',
    'frontend/src/**/*.{js,ts,tsx,vue}',
    'shared/**/*.{js,ts}',
    '!backend/*/src/**/*.d.ts',
    '!frontend/src/**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/*.config.js',
    '!**/migrations/**'
  ],

  coverageDirectory: '<rootDir>/tests/coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary',
    'cobertura'
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './backend/*/src/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './frontend/src/': {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Configuración de tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.js',
    '<rootDir>/tests/setup/enzyme.setup.js'
  ],

  // Globals para ts-jest
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true
      }
    }
  },

  // Tests por tipo
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/'
  ],

  // Mocks globales
  setupFiles: [
    '<rootDir>/tests/mocks/globals.js'
  ],

  // Configuración de snapshots
  snapshotSerializers: [
    'enzyme-to-json/serializer'
  ],

  // Configuración de reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/tests/reports',
      outputName: 'junit.xml',
      suiteName: 'Encore Platform Tests'
    }],
    ['jest-html-reporter', {
      pageTitle: 'Encore Platform - Test Report',
      outputPath: '<rootDir>/tests/reports/test-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true
    }]
  ],

  // Configuración de timeouts
  testTimeout: 10000,

  // Configuración de workers
  maxWorkers: '50%',

  // Configuración de watch
  watchPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/build/',
    '<rootDir>/coverage/',
    '<rootDir>/.git/'
  ],

  // Configuración de CI
  ci: process.env.CI === 'true',

  // Configuración de verbose
  verbose: process.env.CI !== 'true',

  // Configuración de bail
  bail: process.env.CI === 'true' ? 1 : 0,

  // Configuración de detectOpenHandles
  detectOpenHandles: true,

  // Configuración de forceExit
  forceExit: process.env.CI === 'true',

  // Configuración de clearMocks
  clearMocks: true,

  // Configuración de restoreMocks
  restoreMocks: true,

  // Configuración de resetModules
  resetModules: true
};