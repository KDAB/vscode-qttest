#!/bin/bash

# Runs the qttest-utils unit tests.
# Expects Qt test fixtures to be already built (test/qt_test/build-dev/).

set -e

cd "$(dirname "$0")"

# Build qttest-utils into out/qttest-utils/
npm run compile

# Compile the test file (excluded from main tsconfig)
npx tsc -p src/qttest-utils/tsconfig.test.json

node out/qttest-utils/test.js
