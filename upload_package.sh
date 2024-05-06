# SPDX-FileCopyrightText: 2024 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
# Author: Sergio Martins <sergio.martins@kdab.com>
# SPDX-License-Identifier: MIT

# Uploads the qttests-<version>.vsix package to GitHub Release
# Called by .github/workflows/package.yml

# Get latest version and tag:
VERSION=`jq -r '.version' package.json`
TAG_NAME=v$VERSION

PACKAGE_FILENAME=qttests-$VERSION.vsix

if [ ! -f $PACKAGE_FILENAME ]; then
    # Doesn't happen. Package is created by package.yml
    echo "Package $PACKAGE_FILENAME does not exist"
    exit 1
fi

# Check if release exists:
gh release view $TAG_NAME &> /dev/null
if [ $? -ne 0 ]; then
    # Should not happen, as releases are created by release-please
    echo "Release $TAG_NAME does not exist"
    exit 1
fi

# Check if release already contains the asset:
gh release view $TAG_NAME --json assets | jq -r '.assets[].name' | grep -q $PACKAGE_FILENAME

if [ $? -eq 0 ]; then
    echo "Asset $PACKAGE_FILENAME already exists in release $TAG_NAME"
    exit 0
fi

gh release upload $TAG_NAME $PACKAGE_FILENAME
