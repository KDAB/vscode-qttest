// SPDX-FileCopyrightText: 2024 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

import { CMakeTests } from "./cmake";
import { QtTest, QtTests } from "./qttest";

// Be sure to build the Qt tests with CMake first
// See .github/workflows/ci.yml

async function runTests(buildDirPath: string) {
  let qt = new QtTests();
  await qt.discoverViaCMake(buildDirPath);

  // Verify that environment properties from CTest were discovered for test1
  const test1Exe = qt.qtTestExecutables.find((e) =>
    e.filenameWithoutExtension().endsWith("test1"),
  );
  if (!test1Exe) {
    console.error("Expected to find test1 executable after discovery");
    process.exit(1);
  }
  if (!test1Exe.environment || !test1Exe.environment.includes("MY_ENV=VALUE")) {
    console.error(
      "Expected test1 to have environment MY_ENV=VALUE, got: " +
        JSON.stringify(test1Exe.environment),
    );
    process.exit(1);
  }

  let expectedExecutables = [
    "test/qt_test/build-dev/test1",
    "test/qt_test/build-dev/test2",
    "test/qt_test/build-dev/test3",
    "test/qt_test/build-dev/non_qttest",
    "test/qt_test/build-dev/test_gtest",
    "test/qt_test/build-dev/nested_dir/test_nested",
  ];

  if (qt.qtTestExecutables.length !== expectedExecutables.length) {
    console.error(
      "Expected " +
        expectedExecutables.length +
        " executables, got " +
        qt.qtTestExecutables.length,
    );
    process.exit(1);
  }

  // Verify that test_gtest is detected as a GTest
  const gtestExe = qt.qtTestExecutables.find((e) =>
    e.filenameWithoutExtension().endsWith("test_gtest"),
  );
  if (!gtestExe) {
    console.error("Expected to find test_gtest executable after discovery");
    process.exit(1);
  }
  if (!(await gtestExe.isGTest())) {
    console.error("Expected test_gtest to be detected as a GTest");
    process.exit(1);
  }
  console.log("PASS: test_gtest detected as GTest");

  // Verify that test_gtest has no slots after parseAvailableSlots (GTest is skipped)
  await gtestExe.parseAvailableSlots();
  if (!gtestExe.slots || gtestExe.slots.length !== 0) {
    console.error(
      "Expected test_gtest to have 0 slots, got " +
        (gtestExe.slots?.length ?? "null"),
    );
    process.exit(1);
  }
  console.log("PASS: test_gtest has 0 slots (no children)");

  // Verify that a QtTest is not detected as a GTest
  if (await test1Exe.isGTest()) {
    console.error("Expected test1 to NOT be detected as a GTest");
    process.exit(1);
  }
  console.log("PASS: test1 (QtTest) not misdetected as GTest");

  await qt.removeNonLinking();

  /// On macOS and Windows we don't have ldd or equivalent, so we can't check if the test links to QtTest
  /// Use the help way instead
  await qt.removeByRunningHelp();

  /// Remove the non-qttest and gtest executables from qt.qtTestExecutables
  qt.qtTestExecutables = qt.qtTestExecutables.filter(
    (e) =>
      !e.filenameWithoutExtension().endsWith("non_qttest") &&
      !e.filenameWithoutExtension().endsWith("test_gtest"),
  );

  if (qt.qtTestExecutables.length !== 4) {
    console.error(
      "Expected 4 executables, at this point got " +
        qt.qtTestExecutables.length,
    );
    process.exit(1);
  }

  // 1. Test that the executable test names are correct:
  let expectedFilteredExecutables = [
    "test/qt_test/build-dev/test1",
    "test/qt_test/build-dev/test2",
    "test/qt_test/build-dev/test3",
    "test/qt_test/build-dev/nested_dir/test_nested",
  ];
  var i = 0;
  for (var executable of qt.qtTestExecutables) {
    let expected = expectedFilteredExecutables[i];
    if (executable.relativeFilename() !== expected) {
      console.error(
        "Expected executable " +
          expected +
          ", got " +
          executable.relativeFilename(),
      );
      process.exit(1);
    }
    i++;
  }

  // 2. Test that the discovered slots are correct:
  await qt.dumpTestSlots();

  interface ExpectedSlots {
    [key: string]: string[];
  }
  let expectedSlots: ExpectedSlots = {
    "test/qt_test/build-dev/test1": ["slotA", "slotB", "slotC"],
    "test/qt_test/build-dev/test2": ["slotC", "slotD", "slotFail"],
    "test/qt_test/build-dev/test3": ["slotFail2", "slotF", "slotG"],
    "test/qt_test/build-dev/nested_dir/test_nested": [
      "slotNested1",
      "slotNested2",
      "slotNested3",
    ],
  };

  for (var executable of qt.qtTestExecutables) {
    var i = 0;

    for (let slot of executable.slots!) {
      let expectedSlot = expectedSlots[executable.relativeFilename()][i];
      if (slot.name !== expectedSlot) {
        console.error("Expected slot " + expectedSlot + ", got " + slot.name);
        process.exit(1);
      }
      i++;
    }
  }

  // 3. Run the tests:
  let expectedSuccess = [true, false, false, true];
  var i = 0;
  for (var executable of qt.qtTestExecutables) {
    await executable.runTest();
    let wasSuccess = executable.lastExitCode === 0;
    if (wasSuccess && !expectedSuccess[i]) {
      console.error("Expected test to fail: " + executable.filename);
      process.exit(1);
    } else if (!wasSuccess && expectedSuccess[i]) {
      console.error("Expected test to pass: " + executable.filename);
      process.exit(1);
    }

    if (process.platform === "linux") {
      if (!executable.linksToQtTestLib()) {
        console.error(
          "Expected test to link to QtTest: " + executable.filename,
        );
        process.exit(1);
      }
    }

    i++;
  }

  // 4. Run individual slots:
  // Run a passing slot (slotA from test1)
  let slot = qt.qtTestExecutables[0].slots![0];
  await slot.runTest();
  if (slot.lastTestFailure) {
    console.error("Expected test to pass: " + slot.name);
    process.exit(1);
  }

  // Run a failing slot (slotFail from test2)
  let slot2 = qt.qtTestExecutables[1].slots![2];
  await slot2.runTest();
  if (!slot2.lastTestFailure) {
    console.error("Expected test to fail: " + slot2.name);
    process.exit(1);
  }

  // 5. Test executablesContainingSlot
  let executables = qt.executablesContainingSlot("slotB");
  if (executables.length !== 1) {
    console.error("Expected 1 executable, got " + executables.length);
    process.exit(1);
  }

  if (!executables[0].filenameWithoutExtension().endsWith("test1")) {
    console.error("Expected filename to end with test1");
    process.exit(1);
  }

  executables = qt.executablesContainingSlot("non_existing");
  if (executables.length !== 0) {
    console.error("Expected 0 executables, got " + executables.length);
    process.exit(1);
  }
}

async function runCodeModelTests(codeModelFile: string) {
  const fs = require("fs");
  let codemodelStr = fs.readFileSync(codeModelFile, "utf8");
  let codemodelJson = JSON.parse(codemodelStr);

  let cmake = new CMakeTests("random");
  let files = cmake.cppFilesForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test1",
    codemodelJson,
  );
  if (files.length !== 1) {
    console.error("Expected 1 file, got " + files.length);
    process.exit(1);
  }

  let expected = "/vscode-qttest/test/qt_test/test1.cpp";
  let got = files[0].replace(/\\/g, "/");

  if (got !== expected) {
    console.error("Expected " + expected + ", got " + got);
    process.exit(1);
  }

  let targetName = cmake.targetNameForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test1",
    codemodelJson,
  );
  if (targetName !== "test1") {
    console.error("Expected test1, got " + targetName);
    process.exit(1);
  }

  // test windows back slashes:

  files = cmake.cppFilesForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test2",
    codemodelJson,
  );
  if (files.length !== 1) {
    console.error("Expected 1 file, got " + files.length);
    process.exit(1);
  }

  targetName = cmake.targetNameForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test2",
    codemodelJson,
  );
  if (targetName !== "test2") {
    console.error("Expected test2, got " + targetName);
    process.exit(1);
  }

  // test workaround for microsoft/vscode-cmake-tools-api/issues/7
  files = cmake.cppFilesForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test3",
    codemodelJson,
    /*workaround=*/ false,
  );
  if (files.length !== 0) {
    console.error("Expected 0 files, got " + files.length);
    process.exit(1);
  }

  files = cmake.cppFilesForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test3",
    codemodelJson,
    /*workaround=*/ true,
  );
  if (files.length !== 1) {
    console.error("Expected 0 files, got " + files.length);
    process.exit(1);
  }

  targetName = cmake.targetNameForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test3",
    codemodelJson,
    /*workaround=*/ false,
  );
  if (targetName) {
    console.error("Expected null, got " + targetName);
    process.exit(1);
  }

  targetName = cmake.targetNameForExecutable(
    "/vscode-qttest/test/qt_test/build-dev/test3",
    codemodelJson,
    /*workaround=*/ true,
  );
  if (targetName !== "test3") {
    console.error("Expected null, got " + targetName);
    process.exit(1);
  }
}

async function runNonQtTest(buildDirPath: string) {
  let qt = new QtTests();
  await qt.discoverViaCMake(buildDirPath);

  var nonQtExecutable = undefined;
  for (let executable of qt.qtTestExecutables) {
    if (executable.filenameWithoutExtension().endsWith("non_qttest")) {
      nonQtExecutable = executable;
      break;
    }
  }

  if (nonQtExecutable === undefined) {
    console.error("Expected to find non-Qt test executable");
    process.exit(1);
  }

  await nonQtExecutable.runTest();
}

runTests("test/qt_test/build-dev/");
runNonQtTest("test/qt_test/build-dev/");
runCodeModelTests("test/test_cmake_codemodel.json");
