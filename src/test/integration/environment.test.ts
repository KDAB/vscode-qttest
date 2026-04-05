// SPDX-FileCopyrightText: 2024 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as vscode from "vscode";

suite("Environment Variables", function () {
  let controller: vscode.TestController;

  function stripExe(label: string): string {
    return label.replace(/\.exe$/i, "");
  }

  suiteSetup(async function () {
    this.timeout(120000);

    // Activate our extension — returns the TestController
    const ext = vscode.extensions.getExtension("KDAB.qttests");
    assert.ok(ext, "Extension should be installed");
    controller = await ext.activate();
    assert.ok(controller, "activate() should return a TestController");

    // Tell cmake-tools to select the "dev" preset, configure, and build
    console.log("[env-test] Setting configure preset to 'dev'...");
    await vscode.commands.executeCommand(
      "cmake.setConfigurePreset",
      "dev",
    );

    console.log("[env-test] Running cmake.configure...");
    await vscode.commands.executeCommand("cmake.configure");

    console.log("[env-test] Running cmake.build...");
    const buildResult = await vscode.commands.executeCommand("cmake.build");
    console.log(`[env-test] cmake.build returned: ${buildResult}`);

    // Trigger only our extension's test discovery
    console.log("[env-test] Refreshing tests...");
    assert.ok(controller.refreshHandler, "refreshHandler should be set");
    await controller.refreshHandler(
      new vscode.CancellationTokenSource().token,
    );

    // Poll until test items appear (discovery is async)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (controller.items.size > 0) {
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }
    }

    console.log(
      `[env-test] Setup complete. Found ${controller.items.size} test items.`,
    );
  });

  test("ctest ENVIRONMENT property is propagated when running a test slot", async function () {
    this.timeout(30000);

    // CMakeLists.txt sets: set_tests_properties(test1 PROPERTIES ENVIRONMENT "MY_ENV=VALUE")
    // test1.cpp slotB does: QCOMPARE(qgetenv("MY_ENV"), QByteArray("VALUE"))
    // So slotB only passes if the env var is propagated correctly.

    const { thisExtension } = await import("../../extension");

    let test1Item: vscode.TestItem | undefined;
    controller.items.forEach((item) => {
      if (stripExe(item.label) === "test1") {
        test1Item = item;
      }
    });
    assert.ok(test1Item, "test1 should exist");

    let slotBItem: vscode.TestItem | undefined;
    test1Item.children.forEach((child) => {
      if (child.label === "slotB") {
        slotBItem = child;
      }
    });
    assert.ok(slotBItem, "slotB should exist");

    const qtTestSlot = thisExtension.individualTestMap.get(slotBItem);
    assert.ok(qtTestSlot, "slotB should be in individualTestMap");

    const result = await qtTestSlot.runTest();
    assert.strictEqual(
      result,
      true,
      "slotB should pass — MY_ENV=VALUE must be propagated from ctest environment",
    );
  });
});
