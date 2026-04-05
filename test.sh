#!/bin/bash

cmake -S test/qt_test --preset=dev
cmake --build test/qt_test/build-dev --verbose

npm test