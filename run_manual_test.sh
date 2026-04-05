#!/bin/bash

# SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

QT_BUILD_DIR=test/qt_test/build-dev/
VSCODE_DATA=test/qt_test/build-dev/vscode/

code_clean() {
     # Alias for debugging purposes, when needed
    code --user-data-dir "$VSCODE_DATA" --extensions-dir "$VSCODE_DATA" "$@"
}

rm -rf $QT_BUILD_DIR &> /dev/null

echo "Running build_package.sh..."
./build_package.sh

cmake -S test/qt_test/ --preset=dev && \
cmake --build $QT_BUILD_DIR/ && \
code_clean --install-extension qttests-*.vsix \
     --install-extension ms-vscode.cmake-tools \
     --install-extension vadimcn.vscode-lldb && \
code_clean test/qt_test/vscode.code-workspace --crash-reporter-directory /tmp/ \
     --disable-workspace-trust
