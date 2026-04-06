#!/bin/bash

set -e

cmake -S test/qt_test --preset=dev
cmake --build test/qt_test/build-dev --verbose

# qttest-utils unit tests
./test_qttest.sh

# This implicitly calls tsc and launches directly from out/,
# no need to package
npm test
