// SPDX-FileCopyrightText: 2024 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as vscode from "vscode";

suite("Test Discovery", function () {
  let controller: vscode.TestController;

  suiteSetup(async function () {
    this.timeout(120000);

    // Activate our extension — returns the TestController
    const ext = vscode.extensions.getExtension("KDAB.qttests");
    assert.ok(ext, "Extension should be installed");
    controller = await ext.activate();
    assert.ok(controller, "activate() should return a TestController");

    // Tell cmake-tools to select the "dev" preset, configure, and build
    console.log("[discovery-test] Setting configure preset to 'dev'...");
    await vscode.commands.executeCommand(
      "cmake.setConfigurePreset",
      "dev",
    );

    console.log("[discovery-test] Running cmake.configure...");
    await vscode.commands.executeCommand("cmake.configure");

    console.log("[discovery-test] Running cmake.build...");
    const buildResult = await vscode.commands.executeCommand("cmake.build");
    console.log(`[discovery-test] cmake.build returned: ${buildResult}`);

    // Trigger only our extension's test discovery (not cmake-tools' refreshTestsAll,
    // which tries to build and fails on Windows where MSVC env isn't in the extension host)
    console.log("[discovery-test] Refreshing tests...");
    assert.ok(controller.refreshHandler, "refreshHandler should be set");
    await controller.refreshHandler(new vscode.CancellationTokenSource().token);

    // Poll until test items appear (discovery is async)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (controller.items.size > 0) {
        // Give a bit more time for slot parsing to finish
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }
    }

    console.log(
      `[discovery-test] Setup complete. Found ${controller.items.size} test items.`,
    );
  });

  function stripExe(label: string): string {
    return label.replace(/\.exe$/i, "");
  }

  test("discovers test executables", function () {
    const names: string[] = [];
    controller.items.forEach((item) => names.push(stripExe(item.label)));

    assert.ok(
      names.includes("test1"),
      `Expected test1 in [${names.join(", ")}]`,
    );
    assert.ok(
      names.includes("test2"),
      `Expected test2 in [${names.join(", ")}]`,
    );
    assert.ok(
      names.includes("test3"),
      `Expected test3 in [${names.join(", ")}]`,
    );
  });

  test("discovers slots for test1", function () {
    let test1: vscode.TestItem | undefined;
    controller.items.forEach((item) => {
      if (stripExe(item.label) === "test1") {
        test1 = item;
      }
    });
    assert.ok(test1, "test1 should exist");

    const slots: string[] = [];
    test1.children.forEach((child) => slots.push(child.label));
    assert.ok(slots.length > 0, "test1 should have child slots");
  });
});
