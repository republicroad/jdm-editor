const { getJestConfig } = require('@storybook/test-runner');

/**
 * Custom Jest configuration for the Storybook test runner.
 * Picked up automatically (cwd glob `test-runner-jest*`) when running
 * `test-storybook`. Large decision-table stress stories render 10k rules
 * and need more than the default 15s per test.
 *
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...getJestConfig(),
  testTimeout: 120_000,
};
