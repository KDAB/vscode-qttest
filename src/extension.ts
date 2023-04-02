// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as os from 'os';
import { CMakeToolsApi, Version, getCMakeToolsApi, UIElement } from 'vscode-cmake-tools';
import qttest from "@iamsergio/qttest-utils";
import { QtTest, QtTests, QtTestSlot } from '@iamsergio/qttest-utils/out/qttest';


/// A class, so we don't abuse with global variables and functions
class KDABQtTest {
	public channel: vscode.OutputChannel | undefined;
	public testMap = new WeakMap<vscode.TestItem, QtTest>();
	public individualTestMap = new WeakMap<vscode.TestItem, QtTestSlot>();
	public qttests: QtTests | undefined;

	public log(message: string): void {
		if (!this.channel) {
			this.channel = vscode.window.createOutputChannel("KDAB-QtTests");
		}
		this.channel.appendLine(message);
	};

	public checkTestLinksToQtTestLib(): boolean {
		let conf = vscode.workspace.getConfiguration();
		return conf.get("KDAB.QtTest.CheckTestLinksToQtTestLib") ?? false;
	}

	public usesCMakeIntegration(): boolean {
		// Unused for now. We require cmake.
		let conf = vscode.workspace.getConfiguration();
		return conf.get("KDAB.QtTest.useCMakeIntegration") ?? false;
	}

	public defaultDebuggerTypeForPlatform(): string {
		if (os.platform() === "linux") { return "ms-vscode.cpptools gdb"; }
		else if (os.platform() === "darwin") { return "ms-vscode.cpptools lldb"; }
		else { return "ms-vscode.cpptools msvc"; }
	}

	public debuggerConf(): vscode.DebugConfiguration {
		let conf = vscode.workspace.getConfiguration();
		var option = conf.get<string>("KDAB.QtTest.debugger");
		if (!option || option === "default") { option = this.defaultDebuggerTypeForPlatform(); }

		let dbgConf: vscode.DebugConfiguration = { name: "", "request": "launch", "type": "", "program": "", "args": [] };

		if (option === "ms-vscode.cpptools msvc") {
			dbgConf.type = "cppvsdbg";
		} else if (option === "ms-vscode.cpptools lldb") {
			dbgConf.type = "cppdbg";
			dbgConf["MIMode"] = "lldb";
		} else if (option === "ms-vscode.cpptools gdb") {
			dbgConf.type = "cppdbg";
			dbgConf["MIMode"] = "gdb";
		} else if (option === "CodeLLDB") {
			dbgConf.type = "lldb";
		}

		return dbgConf;
	}

	public async discoverAllTestExecutables(controller: vscode.TestController) {
		this.testMap = new WeakMap<vscode.TestItem, QtTest>();
		this.individualTestMap = new WeakMap<vscode.TestItem, QtTestSlot>();

		let buildDirs = await this.cmakeBuildDirs();
		if (buildDirs.length === 0) {
			this.log("ERROR: discoverAllTestExecutables: Failed to figure out cmake build directory");
			return;
		}

		for (let buildDir of buildDirs) {
			this.qttests = new QtTests();
			this.qttests.setLogFunction((message: string) => {
				this.log(message);
			});

			await this.qttests.discoverViaCMake(buildDir);

			if (this.checkTestLinksToQtTestLib()) {
				// Skip tests that don't link to QtTests
				await this.qttests.removeNonLinking();
			}

			if (this.qttests.qtTestExecutables.length === 0) {
				this.log("ERROR: discoverAllTestExecutables: No QtTest executables were found");
				return;
			}

			for (var executable of this.qttests.qtTestExecutables) {
				const item = controller.createTestItem(executable.id, executable.label);
				item.canResolveChildren = true;
				controller.items.add(item);
				executable.vscodeTestItem = item;
				this.testMap.set(item, executable);
			}
		}
	}

	public async parseTestsInExecutable(item: vscode.TestItem, controller: vscode.TestController) {

		let testExecutable: QtTest | undefined = this.testMap.get(item);
		if (!testExecutable) {
			this.log("ERROR: parseTestsInExecutable: No QtTest");
			return;
		}

		try {
			await testExecutable.parseAvailableSlots();
		} catch (e: any) {
			this.log("ERROR: parseTestsInExecutable: Failed to parse slots in: " + testExecutable.filename);
			return;
		}

		if (!testExecutable.slots) {
			this.log("WARN: parseTestsInExecutable: Executable does not have any slots: " + testExecutable.filename)
			return;
		}

		for (let slot of testExecutable.slots) {
			const subitem = controller.createTestItem(slot.id, slot.name);
			slot.vscodeTestItem = subitem;
			item.children.add(subitem);
			this.individualTestMap.set(subitem, slot);
		}
	}

	public async cmakeBuildDirs(): Promise<string[]> {

		const cmakeExt = vscode.extensions.getExtension("ms-vscode.cmake-tools");
		if (!cmakeExt) {
			this.log("ERROR: cmakeBuildDir: ms-vscode.cmake-tools extension is not installed");
			return [];
		}

		const api = await getCMakeToolsApi(Version.latest);
		if (!api) {
			this.log("ERROR: cmakeBuildDir: Could not access cmake api");
			return [];
		}

		let folders = vscode.workspace.workspaceFolders;
		if (!folders || folders.length === 0) {
			this.log("ERROR: cmakeBuildDir: No workspace folders are open");
			return [];
		}


		let buildDirs: string[] = [];
		for (var folder of folders) {
			const proj = await api.getProject(folder.uri);
			if (!proj) {
				this.log("WARN: cmakeBuildDir: No CMake project is open");
				continue;
			}

			let dir = await proj.getBuildDirectory();
			if (dir) {
				buildDirs.push(dir);
			}
		}

		return buildDirs;
	}

	public async debugTest(name: string, executablePath: string, args: string[]): Promise<void> {
		if (vscode.debug.activeDebugSession) {
			this.log("INFO: debugTest: Debugger already running. Ignoring");
			vscode.window.showWarningMessage("Debugger already running, ignoring");
			return;
		}

		return await new Promise(async (resolve, reject) => {
			let debuggerConf = this.debuggerConf();
			debuggerConf.name = name;
			debuggerConf.program = executablePath;
			debuggerConf.args = args;
			let result = await vscode.debug.startDebugging(undefined, debuggerConf);
			if (!result) {
				this.log("Error running debugger. conf=" + JSON.stringify(debuggerConf));
				resolve();
				return;
			}

			vscode.debug.onDidTerminateDebugSession((session: vscode.DebugSession) => {
				resolve();
			});
		});
	}
}

let thisExtension = new KDABQtTest();

async function runHandler(
	shouldDebug: boolean,
	request: vscode.TestRunRequest,
	token: vscode.CancellationToken,
	controller: vscode.TestController) {
	const run = controller.createTestRun(request);
	const queue: vscode.TestItem[] = [];

	if (request.include) {
		request.include.forEach(test => queue.push(test));
	} else {
		controller.items.forEach(test => queue.push(test));
	}

	while (queue.length > 0 && !token.isCancellationRequested) {
		const test = queue.pop()!;

		if (request.exclude?.includes(test)) {
			// User asked to exclude
			continue;
		}

		let singleTestSlot = thisExtension.individualTestMap.get(test);
		let qtTestExecutable = thisExtension.testMap.get(test);

		let functionToRun = singleTestSlot ? singleTestSlot.runTest : qtTestExecutable?.runTest;
		if (!functionToRun) { continue; }
		let ourRunnable = singleTestSlot ? singleTestSlot : qtTestExecutable;
		if (!ourRunnable) { continue; }

		let command: string[] = [];

		const start = Date.now();
		run.appendOutput(`Running ${test.id}\n`);
		run.started(test);
		try {
			let result = false;
			if (shouldDebug) {
				let command = ourRunnable.command();
				await thisExtension.debugTest(command.label, command.executablePath, command.args);
			} else {
				result = await ourRunnable.runTest();

				if (result) {
					run.passed(test, Date.now() - start);
				} else {
					run.failed(test, new vscode.TestMessage("Test failed"), Date.now() - start);
				}

				if (qtTestExecutable) {
					updateStatusForSubTests(qtTestExecutable, run);
				}
			}

		} catch (e: any) {
			thisExtension.log("Failed to run " + ourRunnable.command() + ": " + e.message);
			run.failed(test, new vscode.TestMessage(e.message), Date.now() - start);
		}
	}
	run.end();
}

function updateStatusForSubTests(parentTest: QtTest, run: vscode.TestRun) {
	if (!parentTest.slots) { return; }

	for (var slot of parentTest.slots) {
		if (slot.lastTestFailure) {
			run.failed(slot.vscodeTestItem, new vscode.TestMessage("Test failed on line " + slot.lastTestFailure.lineNumber));
		} else {
			run.passed(slot.vscodeTestItem);
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	thisExtension.log("activated!");

	const controller = vscode.tests.createTestController('kdab.qttest', 'Qt');
	context.subscriptions.push(controller);

	controller.resolveHandler = async test => {
		if (test) {
			await thisExtension.parseTestsInExecutable(test, controller);
		} else {
			await thisExtension.discoverAllTestExecutables(controller);
		}
	};

	const runProfile = controller.createRunProfile(
		'Run',
		vscode.TestRunProfileKind.Run,
		(request, token) => {
			runHandler(false, request, token, controller);
		}
	);

	const debugProfile = controller.createRunProfile(
		'Debug',
		vscode.TestRunProfileKind.Debug,
		(request, token) => {
			runHandler(true, request, token, controller);
		}
	);

}

export function deactivate() { }
