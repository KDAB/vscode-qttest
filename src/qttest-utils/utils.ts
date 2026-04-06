// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

import path from "path";
import * as fs from "fs";

/// Returns whether the specified file is an executable
function isExecutable(filePath: string): boolean {
  if (process.platform === "win32") {
    return path.extname(filePath).toLocaleLowerCase() === ".exe";
  } else {
    try {
      fs.accessSync(filePath, fs.constants.X_OK);
      return true;
    } catch (err) {
      return false;
    }
  }
}

/// Returns whether the specified file is a library
function isLibrary(filename: string): boolean {
  const split = filename.split(".");

  if (split.length <= 1) {
    return false;
  }

  // Find the first non-numeric extension, so we ignore all the trailing numbers in libFoo.so.2.0.9
  for (var i = split.length - 1; i >= 0; --i) {
    const extension = split[i];
    const isNumber = !isNaN(Number(extension));
    if (isNumber) {
      continue;
    }

    return ["so", "dll", "dylib"].includes(extension);
  }

  return false;
}

/// Recursively looks for executable files in folderPath
function executableFiles(folderPath: string): string[] {
  const files = fs.readdirSync(folderPath);
  var executables: string[] = [];
  for (var file of files) {
    // Ignore CMakeFiles directory, it has some of binaries
    if (path.basename(file) === "CMakeFiles") {
      continue;
    }

    const childPath = path.join(folderPath, file);
    const info = fs.statSync(childPath);
    if (info.isDirectory()) {
      executables = executables.concat(executableFiles(childPath));
    } else if (
      info.isFile() &&
      !isLibrary(path.basename(childPath)) &&
      isExecutable(childPath)
    ) {
      executables.push(childPath);
    }
  }

  return executables;
}
