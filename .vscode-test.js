const { defineConfig } = require("@vscode/test-cli");

module.exports = defineConfig({
  files: "out/test/integration/**/*.test.js",
  mocha: {
    timeout: 20000,
    ui: "tdd",
  },
});
