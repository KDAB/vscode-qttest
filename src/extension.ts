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
import { CMakeTests } from '@iamsergio/qttest-utils/out/cmake';


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

	/// returns whether executables exist
	public hasExecutables(): boolean {
		if (!this.qttests) {
			return false;
		}

		return this.qttests.qtTestExecutables.length > 0;
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

	/// Asks the user to pick a launch from a picker
	public async pickDebuggerConfFromLaunch(): Promise<vscode.DebugConfiguration | undefined> {

		try {
			let launches = this.launchConfigs();
			if (launches.length === 0) {
				this.log("ERROR: pickDebuggerConfFromLaunch: No launch configurations found");
				return undefined;
			}

			// create an array of strings, each with a launch configuration name
			let launchNames = launches.map(l => l.name);
			let result = await vscode.window.showQuickPick(launchNames, { placeHolder: "Select debugger" });

			if (!result) {
				this.log("INFO: pickDebuggerConfFromLaunch: User cancelled");
				return undefined;
			}

			let index = launchNames.indexOf(result);
			if (index === -1) {
				this.log("ERROR: pickDebuggerConfFromLaunch: Failed to find index");
				return undefined;
			}

			this.log("INFO: pickDebuggerConfFromLaunch: User selected: " + JSON.stringify(launches[index]));

			return launches[index];
		} catch (e: any) {
			this.log("ERROR: pickDebuggerConfFromLaunch: " + e.message);
			return undefined;
		}
	}

	/// Returns the users launch configurations
	public launchConfigs(): vscode.DebugConfiguration[] {
		let launches: vscode.DebugConfiguration[] = [];

		if (vscode.workspace.workspaceFolders) {
			const config = vscode.workspace.getConfiguration(
				'launch',
				vscode.workspace.workspaceFolders[0].uri
			);

			const values = config.get('configurations');
			if (values instanceof Array) {
				launches = values;
			}
		}

		return launches;
	}

	public async debuggerConf(): Promise<vscode.DebugConfiguration> {
		let conf = vscode.workspace.getConfiguration();
		var option = conf.get<string>("KDAB.QtTest.debugger");
		if (!option || option === "default") { option = this.defaultDebuggerTypeForPlatform(); }

		if (option == "Existing Launch") {
			let launch = await this.pickDebuggerConfFromLaunch();
			if (launch) {
				return launch;
			} else {
				thisExtension.log("ERROR: debuggerConf: Failed to get debugger conf from launch, defaulting.");
				option = this.defaultDebuggerTypeForPlatform();
			}
		}

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

		this.log("INFO: debuggerConf: Using debugger conf: " + dbgConf + "; option=" + option);
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
				await this.addTestExecutable(executable, controller);
			}
		}
	}

	/// Returns the .cpp file that corresponds to the executable
	async cppFileForExecutable(executableFileName: string): Promise<string | undefined> {

		let candidates: string[] = [];
		let api = await getCMakeToolsApi(Version.latest);
		if (!api) {
			this.log("ERROR: cppFileForExecutable: Could not access cmake api");
			return undefined;
		}

		// iterate workspace folders:
		for (let folder of vscode.workspace.workspaceFolders ?? []) {
			let workspaceUri = folder.uri;
			if (!workspaceUri) continue;

			let proj = await api.getProject(workspaceUri);
			if (!proj) {
				this.log("WARN: cppFileForExecutable: No CMake project is open. Maybe run configure first.");
				continue;
			}

			let model = proj.codeModel;
			if (!model) continue;

			let builddir = await proj.getBuildDirectory();
			if (!builddir) continue;

			let cmake = new CMakeTests(builddir);
			model.configurations.forEach((conf) => {
				cmake.cppFilesForExecutable(executableFileName, conf).forEach((cppFile) => {
					candidates.push(cppFile);
				});
			});
		}

		this.log("INFO: candidates=" + candidates + "; for executable=" + executableFileName);

		if (candidates.length === 0) {
			return undefined;
		} else if (candidates.length === 1) {
			return candidates[0];
		} else {
			return candidates[0];
		}
	}

	/// Adds a test executable, it will appear in the vscode test explorer
	async addTestExecutable(executable: QtTest, controller: vscode.TestController) {
		let cppFile = await this.cppFileForExecutable(executable.filename);
		let uri = cppFile ? vscode.Uri.file(cppFile) : undefined;

		this.log("INFO: addTestExecutable: " + executable.filename + "; cppFile=" + cppFile);

		const item = controller.createTestItem(executable.id, executable.label, uri);
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

		this.parseTestsInExecutable(item, controller);
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
			let debuggerConf = await this.debuggerConf();
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
		run.appendOutput(`Running ${test.id}\r\n`);
		run.started(test);
		try {
			let result = false;
			if (shouldDebug) {
				let command = ourRunnable.command();
				await thisExtension.debugTest(command.label, command.executablePath, command.args);
			} else {

				// create a small function, that receives run, and appends output:

				const appendOutput = (run: vscode.TestRun, message: string) => {
					const outputFunc = (message: string) => {
						run.appendOutput(message.trim());
					};

					// vscode "Test Result" pane doesn't support LF, only CRLF. See run.appendOutput() docs
					let lines = message.split("\n");
					for (let line of lines) {
						run.appendOutput(line.trim() + "\r\n");
					}
				};

				if (qtTestExecutable) {
					qtTestExecutable.outputFunc = (message: string) => {
						appendOutput(run, message);
					}
				} else if (singleTestSlot) {
					singleTestSlot.parentQTest.outputFunc = (message: string) => {
						appendOutput(run, message);
					}
				}

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


	// register a command, triggered on context menu:
	context.subscriptions.push(vscode.commands.registerCommand('sergiokdab.qttest.debugTest', async () => {

		// get the text currently selected:
		let editor = vscode.window.activeTextEditor;
		if (!editor) {
			thisExtension.log("INFO: No editor found.");
			return;
		}

		let selection = editor.selection;

		let text = editor.document.getText(selection).trim();

		if (text.endsWith("()")) {
			// trim trailing "()"
			text = text.slice(0, -2);
		}

		thisExtension.log("INFO: Selected text: " + text);

		if (!thisExtension.hasExecutables()) {
			// Probably the 1st load wasn't run yet.
			thisExtension.log("INFO: Refreshing tests");
			await vscode.commands.executeCommand("testing.refreshTests");
			thisExtension.log("INFO: Refreshed tests.");
		}

		let executables = thisExtension.qttests?.executablesContainingSlot(text);

		if (!executables || executables.length === 0) {
			vscode.window.showWarningMessage("No executables found for selection");
			thisExtension.log("INFO: No executables found for selection: " + text);
			return;
		}

		if (executables.length > 1) {
			vscode.window.showWarningMessage("More than one executable contains the slot, please run explicitly from the text explorer.");
			thisExtension.log("INFO: More than one executable contains the slot");
			return;
		}

		// start debug session:
		let executable = executables[0];
		let slot = executable.slotByName(text);
		if (!slot) {
			vscode.window.showWarningMessage("Slot not found in executable");
			thisExtension.log("INFO: Slot not found in executable");
			return;
		}

		thisExtension.log("INFO: Running slot: " + slot.name);
		let command = slot.command();
		await thisExtension.debugTest(command.label, command.executablePath, command.args);
	}));
}

export function deactivate() { }
