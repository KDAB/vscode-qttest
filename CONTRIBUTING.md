# Tips for contributors

## Prepare your development environment

Just follow `.devcontainer/Dockerfile` to see what's needed.<br>

## Build

```
npm install
vsce package
code --install-extension qttest-0.3.0.vsix
```

## Running tests

In the docker (or otherwise), run `run_manual_test.sh` which will build the Qt project, the vscode extension
and open vscode. It should show the test slots in the test explorer.<br>

## Commit

We use conventional commits. Prefix your commit message with `fix: `, `feat: ` or `chore: `
depending if it's a fix, a feature or misc change. This will be used for automatic changelog generation.

## Fixing bugs in the qttest-utils module

Most of the functionallity lives in a separate repo, [qttest-utils](https://github.com/KDAB/qttest-utils/), which is published to npm. After you fix a bug there, bump its version and publish it to npm, then you can edit `package.json` and bump the qttest-utils dependency version.


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
