# Tips for contributors

## Build

```
npm install
vsce package
code --install-extension qttest-*.vsix
```

## Automatic tests

Run `npm test`

## Manual tests

Run `./run_manual_test.sh` which will build the Qt project, the vscode extension
and open vscode. It should show the test slots in the test explorer.<br>

## Commit

We use conventional commits. Prefix your commit message with `fix: `, `feat: ` or `chore: `
depending if it's a fix, a feature or misc change. This will be used for automatic changelog generation.

## The qttest-utils module

Most of the functionality (test discovery, running, result parsing) lives in `src/qttest-utils/`.
It used to be a separate repo published to npm, but it's now part of this repo, so just fix bugs
there directly — no version bumping or publishing involved.

Its unit tests live in `src/qttest-utils/test.ts` and are run with `./test_qttest.sh`, which needs
the Qt test fixtures in `test/qt_test/build-dev/` to be built first (`./test.sh` does both).


## Releasing

Changelog, version bump and tagging is done automatically by merging the release PR. See the [workflow](.github/workflows/release-please.yml).


- Optional: run `npm update` to update packages in package-lock.json. Not needed for every release.
- Optional: `npm outdated` and maybe bump more packages in package.json. Not needed for every release.
- run `run_manual_test.sh` and do some manual testing
- Run `vsce ls` and see if unneeded junk isn't being packaged
- Merge the Release PR if CI is green (you'll need to close and reopen it to trigger CI!)

## Publishing

Packaging is done automatically by the [package.yml](.github/workflows/package.yml) workflow. Which uploads
a package to the GitHub releases page. For example: https://github.com/KDAB/vscode-qttest/releases/tag/v1.8.4

If for some reason there's no *.vsix file under `assets`, you can trigger the workflow manually at https://github.com/KDAB/vscode-qttest/actions/workflows/package.yml

After packaging is done, go to https://marketplace.visualstudio.com/manage/publishers/KDAB and upload the *.vsix file.
