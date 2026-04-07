// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

import { spawn } from "child_process";
import path from "path";
import * as fs from "fs";
import { CMakeTests } from "./cmake";
import { Parser } from "tap-parser";

type LoggerFunction = (arg: string) => void;
var gLogFunction: LoggerFunction | undefined;

export function logMessage(message: string) {
  if (gLogFunction) {
    gLogFunction(message);
  }
}

/**
 * Represents a single QtTest executable.
 * Supports listing the individual test slots
 */
export class QtTest {
  readonly filename: string;
  readonly buildDirPath: string;

  /// If true, will print more verbose output
  verbose: boolean = false;

  /// Allows vscode extensions to associate with a test item
  vscodeTestItem: any | undefined;

  /// The list of individual runnable test slots
  slots: QtTestSlot[] | null = null;

  /// Environment variables coming from CTest (array of "VAR=VALUE")
  environment: string[] = [];

  /// Set after running
  lastExitCode: number = 0;

  /// Allows the caller to receive the output of the test process
  outputFunc: LoggerFunction | undefined = undefined;

  constructor(filename: string, buildDirPath: string) {
    this.filename = filename;
    this.buildDirPath = buildDirPath;
  }

  private isScriptFile(): boolean {
    const ext = path.extname(this.filename).toLowerCase();
    return ext === ".sh" || ext === ".bat";
  }

  public get id() {
    return this.filename;
  }

  public get label() {
    return path.basename(this.filename);
  }

  public relativeFilename() {
    let result = path.relative(process.cwd(), this.filename);

    // strip .exe, as we only use this for tests
    if (result.endsWith(".exe")) {
      result = result.slice(0, -4);
    }

    // normalize slashes
    result = result.replace(/\\/g, "/");

    return result;
  }

  /// returns filename without .exe extension
  public filenameWithoutExtension() {
    let result = this.filename;
    if (result.endsWith(".exe")) {
      result = result.slice(0, -4);
    }

    return result;
  }

  private buildSpawnEnv(): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = Object.assign({}, process.env);
    if (this.environment && Array.isArray(this.environment)) {
      for (const kv of this.environment) {
        const idx = kv.indexOf("=");
        if (idx > -1) {
          env[kv.substring(0, idx)] = kv.substring(idx + 1);
        }
      }
    }
    return env;
  }

  /**
   * Calls "./yourqttest -functions" and stores the results in the slots property.
   */
  public async parseAvailableSlots(): Promise<void> {
    if (this.isScriptFile()) {
      this.slots = [];
      return;
    }
    if (await this.isGTest()) {
      logMessage(
        "qttest: Skipping -functions for GTest executable: " + this.filename,
      );
      this.slots = [];
      return;
    }

    let slotNames: string[] = [];
    let output = "";
    let err = "";

    await new Promise((resolve, reject) => {
      if (!fs.existsSync(this.filename)) {
        reject(new Error("qttest: File doesn't exit: " + this.filename));
        return;
      }

      const child = spawn(this.filename, ["-functions"], {
        cwd: this.buildDirPath,
        env: this.buildSpawnEnv(),
      });

      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        err += chunk.toString();
      });

      child.on("exit", (code) => {
        if (code === 0) {
          slotNames = slotNames.concat(output.split("\n"));
          slotNames = slotNames.map((entry) => entry.trim().replace("()", ""));
          slotNames = slotNames.filter((entry) => entry.length > 0);

          if (slotNames.length > 0) {
            this.slots = [];
            for (var slotName of slotNames) {
              var slot = new QtTestSlot(slotName, this);
              this.slots.push(slot);
            }
          }

          resolve(slotNames);
        } else {
          reject(
            new Error(
              "qttest: Failed to run -functions, stdout=" +
                output +
                "; stderr=" +
                err +
                "; code=" +
                code,
            ),
          );
        }
      });
    });
  }

  /**
   * Returns whether this executable links to libQtTest.so.
   *
   * Useful for Qt autodetection, as some tests are doctest or so.
   *
   * Only implemented for Linux. Returns undefined on other platforms.
   */
  public linksToQtTestLib(): Promise<boolean> | undefined {
    if (this.isScriptFile()) {
      return Promise.resolve(false);
    }

    let isLinux = process.platform === "linux";
    if (!isLinux) {
      return undefined;
    }

    return new Promise((resolve, reject) => {
      if (this.verbose) {
        logMessage("qttest: Running ldd on " + this.filename);
      }

      const child = spawn("ldd", [this.filename]);
      let output = "";
      let result = false;
      child.stdout.on("data", (chunk) => {
        if (!result) {
          if (
            chunk.toString().includes("libQt5Test.so") ||
            chunk.toString().includes("libQt6Test.so")
          ) {
            result = true;
          }
        }

        if (this.verbose) {
          logMessage(chunk.toString());
        }
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve(result);
        } else {
          reject(new Error("qttest: Failed to run ldd"));
        }
      });
    });
  }

  /// Returns whether this test is a QtTest by running it with -help and checking if the help text looks familiar
  /// Note that if this is not a QtTest it might not run help and instead execute the test itself
  public async isQtTestViaHelp(): Promise<boolean | undefined> {
    if (this.isScriptFile()) {
      return false;
    }
    return await new Promise((resolve, reject) => {
      const child = spawn(this.filename, ["-help"], {
        env: this.buildSpawnEnv(),
      });
      let output = "";
      let result = false;
      child.stdout.on("data", (chunk) => {
        if (!result) {
          if (chunk.toString().includes("[testfunction[:testdata]]")) {
            result = true;
          }
        }
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve(result);
        } else {
          resolve(false);
        }
      });
    });
  }

  /// Returns whether this executable is a Google Test by running it with --help
  /// and checking if the output contains the GTest banner
  public async isGTest(): Promise<boolean> {
    if (this.isScriptFile()) {
      return false;
    }
    return await new Promise((resolve) => {
      if (!fs.existsSync(this.filename)) {
        resolve(false);
        return;
      }

      const child = spawn(this.filename, ["--help"], {
        env: this.buildSpawnEnv(),
      });
      let output = "";
      let found = false;
      child.stdout.on("data", (chunk) => {
        if (!found) {
          if (
            chunk
              .toString()
              .includes("This program contains tests written using Google Test")
          ) {
            found = true;
          }
        }
      });

      child.on("exit", () => {
        resolve(found);
      });
    });
  }

  public slotByName(name: string): QtTestSlot | undefined {
    if (!this.slots) {
      return undefined;
    }

    for (let slot of this.slots) {
      if (slot.name === name) {
        return slot;
      }
    }

    return undefined;
  }

  /// Runs this test
  public async runTest(slot?: QtTestSlot, cwd: string = ""): Promise<boolean> {
    let args: string[] = [];
    if (slot) {
      // Runs a single Qt test instead
      args = args.concat(slot.name);
    } else {
      this.clearSubTestStates();
    }

    // log to file and to stdout
    args = args.concat("-o").concat(this.tapOutputFileName(slot) + ",tap");
    args = args.concat("-o").concat(this.txtOutputFileName(slot) + ",txt");
    args = args.concat("-o").concat("-,txt");

    return await new Promise((resolve, reject) => {
      let cwdDir = cwd.length > 0 ? cwd : this.buildDirPath;
      logMessage(
        "Running " +
          this.filename +
          " " +
          args.join(" ") +
          " with cwd=" +
          cwdDir,
      );
      const child = spawn(this.filename, args, {
        cwd: cwdDir,
        env: this.buildSpawnEnv(),
      });

      if (this.outputFunc) {
        // Callers wants the process output:
        child.stdout.on("data", (chunk) => {
          if (this.outputFunc) {
            this.outputFunc(chunk.toString());
          }
        });

        child.stderr.on("data", (chunk) => {
          if (this.outputFunc) {
            this.outputFunc(chunk.toString());
          }
        });
      }

      child.on("exit", async (code) => {
        /// Can code even be null ?
        if (code === undefined || code === null) {
          code = -1;
        }

        if (!slot) {
          this.lastExitCode = code;
        }

        if (this.slots && this.slots.length > 0) {
          /// When running a QtTest executable, let's check which sub-tests failed
          /// (So VSCode can show some error icon for each fail)
          try {
            await this.updateSubTestStates(cwdDir, slot);
          } catch (e) {
            logMessage("ERROR: Failed to update sub-test states: " + e);
          }
        }

        if (code === 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }

  /// Using .tap so we don't have to use a separate XML library
  /// .tap is plain text and a single regexp can catch the failing tests and line number
  public tapOutputFileName(slot?: QtTestSlot): string {
    let slotName = slot ? "_" + slot.name : "";
    return this.label + slotName + ".tap";
  }

  public txtOutputFileName(slot?: QtTestSlot): string {
    let slotName = slot ? "_" + slot.name : "";
    return this.label + slotName + ".txt";
  }

  public command(): { label: string; executablePath: string; args: string[] } {
    return { label: this.label, executablePath: this.filename, args: [] };
  }

  public clearSubTestStates() {
    if (this.slots) {
      for (let slot of this.slots) {
        slot.lastTestFailure = undefined;
      }
    }
  }

  public async updateSubTestStates(cwdDir: string, slot?: QtTestSlot) {
    let tapFileName: string = cwdDir + "/" + this.tapOutputFileName(slot);

    var failures = await new Promise<TestFailure[]>((resolve, reject) => {
      fs.readFile(tapFileName, "utf8", (error, data) => {
        if (error) {
          logMessage("ERROR: Failed to read log file");
          reject(error);
        } else {
          let failedResults: TestFailure[] = [];

          try {
            const tapEvents = Parser.parse(data);
            for (let event of tapEvents) {
              try {
                if (event.length < 2) {
                  continue;
                }
                if (event.at(0) !== "assert") {
                  continue;
                }

                var obj = event.at(1);
                let pass = obj["ok"] === true;

                let xfail = !pass && obj["todo"] !== false;
                if (xfail) {
                  // This is a QEXPECT_FAIL test, all good.
                  // QtTest outputs it as "todo"
                  continue;
                }

                // There's an QEXPECT_FAIL but test passed, not good.
                let xpass =
                  pass && obj["todo"].includes("returned TRUE unexpectedly");

                if (!pass || xpass) {
                  // We found a failure

                  var name = obj["name"].replace(/\(.*\)/, "");
                  var filename = "";
                  var lineNumber = -1;

                  if (obj["diag"]) {
                    filename = obj["diag"]["file"];
                    lineNumber = obj["diag"]["line"];
                  } else {
                    // A XPASS for example misses file:line info. Nothing we can do, it's a Qt bug arguably.
                  }

                  failedResults.push({
                    name: name,
                    filePath: filename,
                    lineNumber: lineNumber,
                  });
                }
              } catch (e) {}
            }
          } catch (e) {}

          resolve(failedResults);
        }
      });
    });

    for (let failure of failures) {
      if (slot && slot.name !== failure.name) {
        // We executed a single slot, ignore anything else
        continue;
      }

      let failedSlot = this.slotByName(failure.name);
      if (failedSlot) {
        failedSlot.lastTestFailure = failure;
      } else {
        logMessage("ERROR: Failed to find slot with name " + failure.name);
      }
    }
  }
}

/**
 * Represents a single Qt test slot
 */
export class QtTestSlot {
  name: string;

  // The QTest executable this slot belongs to
  parentQTest: QtTest;

  /// Allows vscode extensions to associate with a test item
  vscodeTestItem: any | undefined;

  /// Set after running
  lastTestFailure: TestFailure | undefined;

  constructor(name: string, parent: QtTest) {
    this.name = name;
    this.parentQTest = parent;
  }

  public get id() {
    return this.parentQTest.filename + this.name;
  }

  public get absoluteFilePath() {
    return this.parentQTest.filename;
  }

  public async runTest(): Promise<boolean> {
    return this.parentQTest.runTest(this);
  }

  public command(): { label: string; executablePath: string; args: string[] } {
    return {
      label: this.name,
      executablePath: this.absoluteFilePath,
      args: [this.name],
    };
  }
}

/**
 * Represents the list of all QtTest executables in your project
 */
export class QtTests {
  qtTestExecutables: QtTest[] = [];

  async discoverViaCMake(buildDirPath: string) {
    var cmake = new CMakeTests(buildDirPath);
    let ctests = await cmake.tests();
    if (ctests) {
      for (let ctest of ctests) {
        let qtest = new QtTest(ctest.executablePath(), buildDirPath);
        // Propagate environment from CTest metadata
        qtest.environment = ctest.environment;
        this.qtTestExecutables.push(qtest);
      }
    } else {
      logMessage("ERROR: Failed to retrieve ctests!");
    }
  }

  /// Removes any executable (from the list) that doesn't link to libQtTest.so
  /// This heuristic tries to filter-out doctest and other non-Qt tests
  /// Only implemented for linux for now
  public async removeNonLinking() {
    let isLinux = process.platform === "linux";
    if (!isLinux) {
      return;
    }

    let acceptedExecutables: QtTest[] = [];
    for (let ex of this.qtTestExecutables) {
      let linksToQt = await ex.linksToQtTestLib();
      // undefined or true is accepted
      if (linksToQt !== false) {
        acceptedExecutables.push(ex);
      }
      this.qtTestExecutables = acceptedExecutables;
    }
  }

  public setLogFunction(func: LoggerFunction) {
    gLogFunction = func;
  }

  public async removeByRunningHelp() {
    let acceptedExecutables: QtTest[] = [];
    for (const ex of this.qtTestExecutables) {
      const isQtTest = await ex.isQtTestViaHelp();
      if (isQtTest !== false) {
        acceptedExecutables.push(ex);
      }
    }
    this.qtTestExecutables = acceptedExecutables;
  }

  /// Removes any executable (from the list) that matches the specified regex
  public removeMatching(regex: RegExp) {
    this.qtTestExecutables = this.qtTestExecutables.filter(
      (ex) => !regex.test(ex.filename),
    );
  }

  /// Removes any executable (from the list) that doesn't match the specified regex
  public maintainMatching(regex: RegExp) {
    this.qtTestExecutables = this.qtTestExecutables.filter((ex) =>
      regex.test(ex.filename),
    );
  }

  public dumpExecutablePaths() {
    for (var ex of this.qtTestExecutables) {
      console.log(ex.filename);
    }
  }

  public async dumpTestSlots() {
    for (var ex of this.qtTestExecutables) {
      if (!ex.slots) {
        await ex.parseAvailableSlots();
      }

      console.log(ex.filename);
      if (ex.slots) {
        for (let slot of ex.slots) {
          console.log("    - " + slot.name);
        }
      }
    }
  }

  /// Returns all executables that contain a Qt test slot with the specified name
  public executablesContainingSlot(slotName: string): QtTest[] {
    let result: QtTest[] = [];
    for (let ex of this.qtTestExecutables) {
      if (ex.slotByName(slotName)) {
        result.push(ex);
      }
    }
    return result;
  }
}

/// Represents a failure location
export interface TestFailure {
  name: string;
  filePath: string;
  lineNumber: number;
}
