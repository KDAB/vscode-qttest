const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig([
  {
    files: "out/test/integration/smoke.test.js",
    mocha: {
      timeout: 20000,
      ui: "tdd",
    },
  },
  {
    files: "out/test/integration/discovery.test.js",
    workspaceFolder: "./test/qt_test",
    mocha: {
      timeout: 120000,
      ui: "tdd",
    },
  },
  {
    files: "out/test/integration/environment.test.js",
    workspaceFolder: "./test/qt_test",
    mocha: {
      timeout: 120000,
      ui: "tdd",
    },
  },
]);
