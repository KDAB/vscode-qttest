#!/bin/bash

# SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# SPDX-License-Identifier: MIT

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

rm -rf *vsix &> /dev/null

echo "npm install..."
npm install

echo "Compiling..."
npm run compile

echo "Pruning..."
npm prune --production

echo "vsce package..."
vsce package
