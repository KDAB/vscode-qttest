// SPDX-FileCopyrightText: 2024 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as vscode from "vscode";

const CWD_FILE = "/tmp/slotA.cwd";

suite("Debug CWD", function () {
  let controller: vscode.TestController;

  function stripExe(label: string): string {
    return label.replace(/\.exe$/i, "");
  }

  suiteSetup(async function () {
    if (os.platform() !== "linux") {
      this.skip();
      return;
    }

    this.timeout(120000);

    const ext = vscode.extensions.getExtension("KDAB.qttests");
    assert.ok(ext, "Extension should be installed");
    controller = await ext.activate();
    assert.ok(controller, "activate() should return a TestController");

    console.log("[debug-cwd-test] Setting configure preset to 'dev'...");
    await vscode.commands.executeCommand("cmake.setConfigurePreset", "dev");

    console.log("[debug-cwd-test] Running cmake.configure...");
    await vscode.commands.executeCommand("cmake.configure");

    console.log("[debug-cwd-test] Running cmake.build...");
    const buildResult = await vscode.commands.executeCommand("cmake.build");
    console.log(`[debug-cwd-test] cmake.build returned: ${buildResult}`);

    console.log("[debug-cwd-test] Refreshing tests...");
    assert.ok(controller.refreshHandler, "refreshHandler should be set");
    await controller.refreshHandler(
      new vscode.CancellationTokenSource().token,
    );

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      if (controller.items.size > 0) {
        await new Promise((r) => setTimeout(r, 2000));
        break;
      }
    }

    // Clean up any leftover file from a previous run
    if (fs.existsSync(CWD_FILE)) {
      fs.unlinkSync(CWD_FILE);
    }

    console.log(
      `[debug-cwd-test] Setup complete. Found ${controller.items.size} test items.`,
    );
  });

  test("debugTest uses cwd from Existing Launch config", async function () {
    if (os.platform() !== "linux") {
      this.skip();
      return;
    }

    this.timeout(60000);

    // slotA in test1.cpp writes QDir::currentPath() to /tmp/slotA.cwd.
    // We stub debuggerConf() to return a config with cwd="/tmp/" (simulating
    // the "CustomCWD" Existing Launch config). If cwd is properly passed
    // through to the debugger, slotA will write "/tmp" to the file.

    const { thisExtension } = await import("../../extension");

    let test1Item: vscode.TestItem | undefined;
    controller.items.forEach((item) => {
      if (stripExe(item.label) === "test1") {
        test1Item = item;
      }
    });
    assert.ok(test1Item, "test1 should exist");

    let slotAItem: vscode.TestItem | undefined;
    test1Item.children.forEach((child) => {
      if (child.label === "slotA") {
        slotAItem = child;
      }
    });
    assert.ok(slotAItem, "slotA should exist");

    const qtTestSlot = thisExtension.individualTestMap.get(slotAItem);
    assert.ok(qtTestSlot, "slotA should be in individualTestMap");

    // Stub debuggerConf to return a config with cwd="/tmp/" (as if user
    // picked the "CustomCWD" launch configuration)
    const originalDebuggerConf =
      thisExtension.debuggerConf.bind(thisExtension);
    thisExtension.debuggerConf = async () => ({
      name: "CustomCWD",
      type: "lldb",
      request: "launch",
      program: "",
      args: [],
      cwd: "/tmp/",
    });

    try {
      const command = qtTestSlot.command();

      // Register the termination listener before starting the debug session,
      // since the test may finish before debugTest() returns.
      const sessionDone = new Promise<void>((resolve) => {
        const disposable = vscode.debug.onDidTerminateDebugSession(() => {
          disposable.dispose();
          resolve();
        });
      });

      await thisExtension.debugTest(
        command.label,
        command.executablePath,
        command.args,
      );

      await sessionDone;

      // Give a moment for the file to be flushed
      await new Promise((r) => setTimeout(r, 1000));

      assert.ok(fs.existsSync(CWD_FILE), `${CWD_FILE} should have been created by slotA`);
      const cwd = fs.readFileSync(CWD_FILE, "utf-8").trim();
      assert.strictEqual(
        cwd,
        "/tmp",
        `slotA should have run with cwd=/tmp, but got: ${cwd}`,
      );
    } finally {
      thisExtension.debuggerConf = originalDebuggerConf;
      if (fs.existsSync(CWD_FILE)) {
        fs.unlinkSync(CWD_FILE);
      }
    }
  });
});
