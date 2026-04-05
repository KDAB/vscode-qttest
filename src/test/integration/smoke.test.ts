// SPDX-FileCopyrightText: 2024 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// SPDX-License-Identifier: MIT

import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Smoke Tests", () => {
  const extensionId = "KDAB.qttests";

  test("extension is present", () => {
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext, `Extension ${extensionId} should be installed`);
  });

  test("extension activates successfully", async () => {
    const ext = vscode.extensions.getExtension(extensionId);
    assert.ok(ext);
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });

  test("KDAB.qttest.debugTest command is registered", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(
      commands.includes("KDAB.qttest.debugTest"),
      "debugTest command should be registered",
    );
  });

  test("configuration keys are declared", () => {
    const config = vscode.workspace.getConfiguration("KDAB.QtTest");
    const debugger_ = config.inspect("debugger");
    assert.ok(debugger_, "KDAB.QtTest.debugger should be declared");
    assert.strictEqual(
      debugger_?.defaultValue,
      "default",
      "debugger default should be 'default'",
    );

    const checkLinks = config.inspect("CheckTestLinksToQtTestLib");
    assert.ok(
      checkLinks,
      "KDAB.QtTest.CheckTestLinksToQtTestLib should be declared",
    );
    assert.strictEqual(
      checkLinks?.defaultValue,
      false,
      "CheckTestLinksToQtTestLib default should be false",
    );
  });
});
