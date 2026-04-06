// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

import { spawn } from "child_process";
import path from "path";
import { logMessage } from "./qttest";
import { fstatSync } from "fs";

/**
 * Represents tests added in cmake (Via add_test())
 *
 * Contains methods to discover Qt Tests via CMake
 */
export class CMakeTests {
  // The build dir where we'll run
  readonly buildDirPath: string;

  constructor(buildDirPath: string) {
    this.buildDirPath = buildDirPath;
  }

  /**
   * Invokes ctest.exe --show-only=json-v1
   *
   * @returns a promise with the list of tests
   */
  public async tests(): Promise<CMakeTest[] | undefined> {
    // TODO: Check if folder exists
    if (this.buildDirPath.length === 0) {
      console.error("Could not find out cmake build dir");
      return undefined;
    }

    return new Promise((resolve, reject) => {
      logMessage(
        "Running ctest --show-only=json-v1 with cwd=" + this.buildDirPath,
      );
      const child = spawn("ctest", ["--show-only=json-v1"], {
        cwd: this.buildDirPath,
      });
      let output = "";
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          if (output.length === 0) {
            console.error(
              "ctestJsonToList: Empty json output. Command was ctest --show-only=json-v1 , in " +
                this.buildDirPath,
            );
            reject(new Error("Failed to get ctest JSON output"));
          } else {
            resolve(this.ctestJsonToList(output));
          }
        } else {
          reject(new Error("Failed to run ctest"));
        }
      });

      return undefined;
    });
  }

  private ctestJsonToList(json: string): CMakeTest[] {
    let allJSON = JSON.parse(json);

    if (!("tests" in allJSON)) {
      return [];
    }

    let tests: CMakeTest[] = allJSON.tests.map((testJSON: any) => {
      let test = new CMakeTest();
      test.command = testJSON.command;
      test.cwd = testJSON.cwd;

      // Extract environment information if present in ctest JSON.
      // ctest may expose environment as `environment` (string or array),
      // or embed it into `properties` either as an object or array.
      try {
        let envArr: string[] | undefined = undefined;

        if (testJSON.environment) {
          envArr = Array.isArray(testJSON.environment)
            ? testJSON.environment
            : [testJSON.environment];
        }

        if (!envArr && testJSON.properties) {
          const props = testJSON.properties;

          // properties might be an object with ENVIRONMENT key or an array of {name,value} entries
          if (!Array.isArray(props) && props.ENVIRONMENT) {
            const val = props.ENVIRONMENT;
            if (typeof val === "string") {
              envArr = [val];
            } else if (Array.isArray(val)) {
              envArr = val;
            }
          } else if (Array.isArray(props)) {
            for (const p of props) {
              if (!p || !p.name) {
                continue;
              }
              if (p.name === "ENVIRONMENT" || p.name === "Environment") {
                const v = p.value;
                if (typeof v === "string") {
                  envArr = [v];
                } else if (Array.isArray(v)) {
                  envArr = v;
                }
                break;
              }
            }
          }
        }

        if (envArr) {
          test.environment = envArr;
        }
      } catch (e) {
        try {
          logMessage(
            "ctest: failed to parse environment for test: " +
              JSON.stringify(testJSON) +
              " error: " +
              e,
          );
        } catch (_) {}
      }

      return test;
    });

    // filter invalid tests:
    tests = tests.filter((test) => {
      // pretty print test
      if (!test.command || test.command.length === 0) {
        return false;
      }

      let testExecutablePath = test.executablePath();
      let baseName = path.basename(testExecutablePath).toLowerCase();
      if (baseName.endsWith(".exe")) {
        baseName = baseName.substring(0, baseName.length - 4);
      }

      // People doing complicated things in add_test()
      if (baseName === "ctest" || baseName === "cmake") {
        return false;
      }

      return true;
    });

    return tests;
  }

  /// Returns the cmake target name for the specified executable
  /// codemodel should have a "projects" key at root.
  public targetNameForExecutable(
    executable: string,
    codemodel: any,
    workaround: boolean = false,
  ): string | undefined {
    let projects = codemodel["projects"];
    if (!projects) {
      return undefined;
    }

    for (let project of projects) {
      let targets = project["targets"];
      if (!targets) {
        continue;
      }

      for (let target of targets) {
        let artifacts = target["artifacts"];
        if (!artifacts) {
          continue;
        }

        for (let artifact of artifacts) {
          if (artifact.endsWith(".exe")) {
            artifact = artifact.substring(0, artifact.length - 4);
          }

          if (this.filenamesAreEqual(executable, artifact, workaround)) {
            let name = target["name"];
            if (name) {
              // We found the target name
              return name;
            }
          }
        }
      }
    }

    return undefined;
  }

  /// Returns whether the two filenames are equal
  /// If workaround is true, then we workaround microsoft/vscode-cmake-tools-api/issues/7 where
  /// the basename is correct but the path is bogus, and we only compare the basenames
  filenamesAreEqual(
    file1: string,
    file2: string,
    workaround: boolean = false,
  ): boolean {
    if (file1.endsWith(".exe")) {
      file1 = file1.substring(0, file1.length - 4);
    }

    if (file2.endsWith(".exe")) {
      file2 = file2.substring(0, file2.length - 4);
    }

    file1 = file1.replace(/\\/g, "/");
    file2 = file2.replace(/\\/g, "/");

    if (process.platform === "win32") {
      file1 = file1.toLowerCase();
      file2 = file2.toLowerCase();
    }

    if (file1 === file2) {
      return true;
    }

    if (!workaround) {
      // files aren't equal!
      return false;
    }

    const fs = require("fs");
    if (fs.existsSync(file2)) {
      // It's a real file, not bogus.
      return false;
    }

    /// Compare only basename, since path is bogus
    return path.basename(file1, ".exe") === path.basename(file2, ".exe");
  }

  /// Returns the list of .cpp files for the specified executable
  /// codemodel is the CMake codemodel JSON object
  /// codemodel should have a "projects" key at root.
  /// @param workaround If true, worksaround https://github.com/microsoft/vscode-cmake-tools-api/issues/7
  public cppFilesForExecutable(
    executable: string,
    codemodel: any,
    workaround: boolean = false,
  ): string[] {
    let projects = codemodel["projects"];
    if (!projects) {
      return [];
    }

    for (let project of projects) {
      let targets = project["targets"];
      if (!targets) {
        continue;
      }

      for (let target of targets) {
        let sourceDir = target["sourceDirectory"];
        let artifacts = target["artifacts"];
        if (!artifacts || !sourceDir) {
          continue;
        }

        let targetType = target["type"];
        if (targetType !== "EXECUTABLE") {
          continue;
        }

        for (let artifact of artifacts) {
          if (artifact.endsWith(".exe")) {
            artifact = artifact.substring(0, artifact.length - 4);
          }

          // replace backslashes with forward slashes
          artifact = artifact.replace(/\\/g, "/");

          if (this.filenamesAreEqual(executable, artifact, workaround)) {
            let fileGroups = target["fileGroups"];
            if (!fileGroups) {
              continue;
            }

            for (let fileGroup of fileGroups) {
              if (fileGroup["language"] !== "CXX" || fileGroup["isGenerated"]) {
                continue;
              }

              let sources = fileGroup["sources"];
              if (!sources) {
                continue;
              }

              let cppFiles: string[] = [];
              for (let source of sources) {
                if (!source.endsWith("mocs_compilation.cpp")) {
                  cppFiles.push(path.join(sourceDir, source));
                }
              }

              return cppFiles;
            }
          }
        }
      }
    }

    logMessage(
      "cppFilesForExecutable: Could not find cpp files for executable " +
        executable,
    );
    return [];
  }
}

/// Represents an inividual CTest test
export class CMakeTest {
  public command: string[] = [];
  public cwd: string = "";
  public environment: string[] = [];

  public id(): string {
    return this.command.join(",");
  }

  public label(): string {
    return path.basename(this.executablePath());
  }

  public executablePath(): string {
    return this.command[0];
  }
}
