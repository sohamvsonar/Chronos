module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'services/**/*.js',
    'packages/**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
  ],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],
  testTimeout: 30000,
  verbose: true,
};
