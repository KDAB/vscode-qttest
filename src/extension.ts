// SPDX-FileCopyrightText: 2023 Klarälvdalens Datakonsult AB, a KDAB Group company <info@kdab.com>
// Author: Sergio Martins <sergio.martins@kdab.com>
// SPDX-License-Identifier: MIT

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import * as os from 'os';
import { CMakeToolsApi, Version, getCMakeToolsApi, UIElement, Project } from 'vscode-cmake-tools';
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

	/// List of build-directories we rebuilt before running tests in
	public currentDoneRebuilds: Set<string> = new Set();;

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
	/// Maybe rebuilds
	/// Called before running tests.
	/// Returns true on success
	public async maybeRebuild(executableFileName: string): Promise<boolean> {
		try {
			let projects = await this.projectsForExecutable(executableFileName);
			if (!projects || projects.length === 0) {
				this.log("ERROR: maybeRebuild: Failed to get projects for executable: " + executableFileName);
				return false;
			}

			let cmake = new CMakeTests(/*dummy*/"");

			/// Can't see why there would be more than 1 project for the same executable
			/// we support it, but won't happen	in practice
			for (let project of projects) {
				let conf = project.codeModel?.configurations[0];
				if (!conf) continue;

				let buildDir = await project.getBuildDirectory();
				if (!buildDir) continue;

				// When running a group of slots, be sure to not build the same build dir twice
				if (this.currentDoneRebuilds.has(buildDir))
					continue;

				let targetName = cmake.targetNameForExecutable(executableFileName, conf);
				if (!targetName) {
					// apply workaround for https://github.com/microsoft/vscode-cmake-tools-api/issues/7
					targetName = cmake.targetNameForExecutable(executableFileName, conf,  /*workaround=*/ true);
					if (targetName) {
						this.log("INFO: maybeRebuild: Rebuilding target: " + targetName);
						await project.build([targetName]);
						this.currentDoneRebuilds.add(buildDir);
					} else {
						this.log("ERROR: maybeRebuild: Failed to get target name for executable: " + executableFileName + "; codemodel was:\n"
							+ JSON.stringify(project.codeModel, null, 2));
					}
				}
			}

			return true;
		} catch (e: any) {
			this.log("ERROR: maybeRebuild: " + e.message);
			return false;
		}
	}

	/// Returns true if all is ok, false if the user was warned due to missing debugger.
	public maybeWarnOfMissingDebugger(type: string): boolean {
		let extensionId = this.extensionIdForDebuggerType(type);
		let ext = vscode.extensions.getExtension(extensionId);
		if (!ext) {
			let msg = "You chose debugger type \"" + type + "\", but the extension " + extensionId + " is not installed."
			"Please install it or chose a different debugger.";

			let detail = "Popular debuggers are ms-vscode.cpptools and vadimcn.vscode-lldb (CodeLLDB). Set KDAB.QtTest.debugger setting accordingly. You can also set it to \"Existing Launch\" and pick a launch configuration as template.";

			this.log("ERROR: maybeWarnOfMissingDebugger" + msg);
			vscode.window.showErrorMessage(msg, { modal: true, detail: detail }, "Open settings").then((value) => {
				if (value === "Open settings") {
					vscode.commands.executeCommand("workbench.action.openSettings", "KDAB.QtTest.debugger");
				} else {
					this.log("INFO: maybeWarnOfMissingDebugger: User cancelled");
				}
			});

			return false;
		}

		return true;
	}

	/// Returns the extension id for the specified debugger type
	public extensionIdForDebuggerType(type: string): string {
		if (type === "cppvsdbg" || type === "cppdbg") {
			return "ms-vscode.cpptools";
		} else if (type === "lldb") {
			return "vadimcn.vscode-lldb";
		}

		return "";
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

	/// Returns the projects that contains the executable
	/// Usually only 1
	async projectsForExecutable(executableFileName: string): Promise<Project[] | undefined> {
		let api = await getCMakeToolsApi(Version.latest);
		if (!api) {
			this.log("ERROR: projectsForExecutable: Could not access cmake api");
			return undefined;
		}

		let projects: Project[] = [];
		let workspaceFolders = vscode.workspace.workspaceFolders ?? [];
		if (workspaceFolders.length === 0) {
			this.log("ERROR: projectsForExecutable: No workspace folders are open");
			return undefined;
		}

		for (let folder of workspaceFolders) {
			let workspaceUri = folder.uri;
			if (!workspaceUri) {
				this.log("ERROR: projectsForExecutable: No workspace uri");
				continue;
			}

			let proj = await api.getProject(workspaceUri);
			if (!proj) {
				this.log("WARN: projectsForExecutable: No CMake project is open. Maybe run configure first.");
				continue;
			}

			let model = proj.codeModel;
			if (!model) {
				this.log("WARN: projectsForExecutable: No code model");
				continue;
			}

			if (model.configurations.length === 0) {
				this.log("WARN: projectsForExecutable: No configurations");
				continue;
			}

			let builddir = await proj.getBuildDirectory();
			if (!builddir) {
				this.log("WARN: projectsForExecutable: No build directory");
				continue;
			}

			let cmake = new CMakeTests(builddir);

			let found = false;
			model.configurations.forEach((conf) => {
				if (found) return;

				let targetName = cmake.targetNameForExecutable(executableFileName, conf);

				if (targetName) {
					found = true;
				} else {
					/// Workaround for https://github.com/microsoft/vscode-cmake-tools-api/issues/7
					targetName = cmake.targetNameForExecutable(executableFileName, conf, /*workaround=*/ true);

					if (targetName) {
						found = true;
					} else {
						// For debug only
						// let tmpFile = "/tmp/foo3.json_" + path.basename(executableFileName);
						// fs.writeFileSync(tmpFile, JSON.stringify(conf, null, 2));
						this.log("WARN: projectsForExecutable: not found even with workaround");
					}
				}
			});

			if (found)
				projects.push(proj);
		}

		if (projects.length === 0) {
			this.log("WARN: projectsForExecutable: No projects found for executable: " + executableFileName);
		}

		return projects;
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

			// if (candidates.length === 0) {
			// 	this.log("INFO: cppFileForExecutable: No candidate found in current config. model was:" + JSON.stringify(model.configurations, null, 2));
			// }
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
			/// We just use the same URI as the parent, as vscode doesn't support line:column in urls
			let slotUri = testExecutable.vscodeTestItem.uri;

			const subitem = controller.createTestItem(slot.id, slot.name, slotUri);
			subitem.range = await this.rangeForSlot(slot);
			slot.vscodeTestItem = subitem;
			item.children.add(subitem);
			this.individualTestMap.set(subitem, slot);
		}
	}

	async rangeForSlot(slot: QtTestSlot): Promise<vscode.Range | undefined> {
		let executable = slot.parentQTest;
		let cppFile = await this.cppFileForExecutable(executable.filename);
		if (!cppFile) return undefined;

		// Read contents of cppFile:
		let contents = fs.readFileSync(cppFile, "utf8");
		let lines = contents.split("\n");
		// find which line number has the text slot.name
		let lineNumber = lines.findIndex((line) => line.includes(slot.name + "()"));
		if (lineNumber == -1) return undefined;

		return new vscode.Range(lineNumber, 0, lineNumber, 0);
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

			if (!this.maybeWarnOfMissingDebugger(debuggerConf.type)) {
				this.log("ERROR: debugTest: Bailing out, missing debugger extension");
				resolve();
				return;
			}

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

	thisExtension.currentDoneRebuilds.clear();

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
				await thisExtension.maybeRebuild(command.executablePath);
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

				await thisExtension.maybeRebuild(ourRunnable.command().executablePath);
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
