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


const DEBUGGER_MS_GDB = "ms-vscode.cpptools gdb";
const DEBUGGER_MS_LLDB = "ms-vscode.cpptools lldb";
const DEBUGGER_MS_MSVC = "ms-vscode.cpptools msvc";
const DEBUGGER_CODELLDB = "CodeLLDB";

/// A class, so we don't abuse with global variables and functions
class KDABQtTest {
	public channel: vscode.OutputChannel | undefined;
	public testMap = new WeakMap<vscode.TestItem, QtTest>();
	public individualTestMap = new WeakMap<vscode.TestItem, QtTestSlot>();
	public qttests: QtTests | undefined;
	public watcher: vscode.FileSystemWatcher | undefined;

	// add a map, which as key the executable file name and value a file system watcher
	watcherMap = new Map<string, vscode.FileSystemWatcher>();

	public log(message: string): void {
		if (!this.channel) {
			this.channel = vscode.window.createOutputChannel("KDAB-QtTests");
		}
		this.channel.appendLine(message);
	};

	/// If true, means we check if tests link to QtTestLib 
	public checkTestLinksToQtTestLib(): boolean {
		let conf = vscode.workspace.getConfiguration();
		return conf.get("KDAB.QtTest.CheckTestLinksToQtTestLib") ?? false;
	}

	/// Unused for now. We require cmake.
	public usesCMakeIntegration(): boolean {
		let conf = vscode.workspace.getConfiguration();
		return conf.get("KDAB.QtTest.useCMakeIntegration") ?? false;
	}

	public defaultDebuggerTypeForPlatform(): string {
		if (os.platform() === "linux") { return DEBUGGER_MS_GDB; }
		else if (os.platform() === "darwin") { return DEBUGGER_MS_LLDB; }
		else { return DEBUGGER_MS_MSVC; }
	}

	public debuggerConf(): vscode.DebugConfiguration {
		let conf = vscode.workspace.getConfiguration();
		var option = conf.get<string>("KDAB.QtTest.debugger");
		if (!option || option === "default") { option = this.defaultDebuggerTypeForPlatform(); }

		let dbgConf: vscode.DebugConfiguration = { name: "", "request": "launch", "type": "", "program": "", "args": [] };

		if (option === DEBUGGER_MS_MSVC) {
			dbgConf.type = "cppvsdbg";
		} else if (option === DEBUGGER_MS_LLDB) {
			dbgConf.type = "cppdbg";
			dbgConf["MIMode"] = "lldb";
		} else if (option === DEBUGGER_MS_GDB) {
			dbgConf.type = "cppdbg";
			dbgConf["MIMode"] = "gdb";
		} else if (option === DEBUGGER_CODELLDB) {
			dbgConf.type = "lldb";
		}

		return dbgConf;
	}

	public async clearAllTests(controller: vscode.TestController) {
		this.log("INFO: clearAllTests");

		controller.items.forEach(item => {
			controller.items.delete(item.id);
		});

		for (let watcher of this.watcherMap.values()) {
			watcher.dispose();
		}

		this.watcherMap.clear();
	}

	public async refreshTests(controller: vscode.TestController) {
		this.log("INFO: refreshTests");

		await this.clearAllTests(controller);
		await this.discoverAllTestExecutables(controller);
	}

	public async discoverAllTestExecutables(controller: vscode.TestController) {
		this.log("INFO: discoverAllTestExecutables");

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
			this.log("INFO: discoverAllTestExecutables: Found " + this.qttests.qtTestExecutables.length + " executables in " + buildDir);

			if (this.checkTestLinksToQtTestLib()) {
				// Skip tests that don't link to QtTests
				this.log("INFO: discoverAllTestExecutables: Removing non-Qt tests, if any");

				await this.qttests.removeNonLinking();
			}

			if (this.qttests.qtTestExecutables.length === 0) {
				this.log("ERROR: discoverAllTestExecutables: No QtTest executables were found");
				return;
			}

			for (var executable of this.qttests.qtTestExecutables) {
				this.log("INFO: discoverAllTestExecutables: Found: " + executable.filename);

				this.addTestExecutable(executable, controller);
			}
		}
	}

	/// Adds a test executable, it will appear in the vscode test explorer
	addTestExecutable(executable: QtTest, controller: vscode.TestController) {
		this.log("INFO: addTestExecutable: " + executable.filename);
		const item = controller.createTestItem(executable.id, executable.label);
		item.canResolveChildren = true;
		controller.items.add(item);
		executable.vscodeTestItem = item;
		this.testMap.set(item, executable);

		let watcher = vscode.workspace.createFileSystemWatcher(executable.filename);
		this.watcherMap.set(executable.filename, watcher);

		watcher.onDidChange((e: vscode.Uri) => {
			this.log("INFO: File changed: " + e.fsPath);
			this.parseTestsInExecutable(item, controller);
		});
	}

	public async parseTestsInExecutable(item: vscode.TestItem, controller: vscode.TestController) {
		this.log("INFO: parseTestsInExecutable");

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
			this.log("WARN: parseTestsInExecutable: Executable does not have any slots: " + testExecutable.filename);
			return;
		}

		this.log("INFO: parseTestsInExecutable: Found " + testExecutable.slots.length + " slots in " + testExecutable.filename);

		item.children.forEach(child => {
			item.children.delete(child.id);
		});

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

		for (var dir of buildDirs) {
			this.log("INFO: cmakeBuildDirs: " + dir);
		}

		return buildDirs;
	}

	public async debugTest(name: string, executablePath: string, args: string[]): Promise<void> {
		this.log("INFO: debugTest: name=" + name + " executablePath=" + executablePath + " args=" + args);

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
				this.log("ERROR: while running debugger. conf=" + JSON.stringify(debuggerConf));
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

	// print log, with values of arguments
	thisExtension.log("runHandler: shouldDebug=" + shouldDebug + "; request=" + request + "; token=" + token + "; controller=" + controller);

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
					updateStatusForSubTests(qtTestExecutable, run, result);
				}
			}

		} catch (e: any) {
			thisExtension.log("Failed to run " + ourRunnable.command() + ": " + e.message);
			run.failed(test, new vscode.TestMessage(e.message), Date.now() - start);
		}
	}
	run.end();
}

function updateStatusForSubTests(parentTest: QtTest, run: vscode.TestRun, success: boolean) {
	if (!parentTest.slots) {
		thisExtension.log("INFO: updateStatusForSubTests: parentTest.slots is empty. Skipping");
		return;
	}

	for (var slot of parentTest.slots) {
		if (slot.lastTestFailure) {
			run.failed(slot.vscodeTestItem, new vscode.TestMessage("Test failed on line " + slot.lastTestFailure.lineNumber));
		} else {
			// It didn't fail, but we don't know if it passed. Unless the parent test passed as well.
			if (success) { run.passed(slot.vscodeTestItem); }
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	thisExtension.log("activated!");

	const controller = vscode.tests.createTestController('kdab.qttest', 'Qt');

	// Called when user presses the refresh tests button
	controller.refreshHandler = async () => {
		thisExtension.log("INFO: refreshHandler");
		await thisExtension.refreshTests(controller);
	}

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
