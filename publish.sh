#!/bin/bash

# SPDX-FileCopyrightText: 2026 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# Author: Sergio Martins <sergio.martins@kdab.com>
# SPDX-License-Identifier: MIT

# Publishes the .vsix from the latest GitHub release to the VS Marketplace

set -e

SCRIPT_DIR=$(dirname "$(realpath "$0")")
cd "$SCRIPT_DIR"

if ! az account show &> /dev/null; then
    echo "Not logged in to Azure. Run 'az login --allow-no-subscriptions' first."
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "Not logged in to GitHub. Run 'gh auth login' first."
    exit 1
fi

TAG_NAME=$(gh release view --json tagName --jq '.tagName')

DOWNLOAD_DIR=$(mktemp -d)
trap 'rm -rf "$DOWNLOAD_DIR"' EXIT

echo "Downloading .vsix from release $TAG_NAME..."
gh release download "$TAG_NAME" --pattern '*.vsix' --dir "$DOWNLOAD_DIR"

PACKAGE_PATH=$(ls "$DOWNLOAD_DIR"/*.vsix)
if [ $(echo "$PACKAGE_PATH" | wc -l) -ne 1 ]; then
    echo "Expected exactly one .vsix in release $TAG_NAME, found:"
    echo "$PACKAGE_PATH"
    exit 1
fi

echo "Publishing $(basename "$PACKAGE_PATH")..."
npx @vscode/vsce publish --packagePath "$PACKAGE_PATH" --azure-credential
