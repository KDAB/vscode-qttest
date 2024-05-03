# Tips for contributors

## Prepare your development environment

Just follow `.devcontainer/Dockerfile` to see what's needed.<br?>

## Build

```
npm install
vsce package
code --install-extension qttest-0.3.0.vsix
```

## Running tests

In the docker, run `run_manual_test.sh` which will build the Qt project, the vscode extension
and open vscode. It should show the test slots in the test explorer.<br>
Or just run the script locally.

## Commit

We use conventional commits. Prefix your commit message with `fix: `, `feat: ` or `chore: `
depending if it's a fix, a feature or misc change. This will be used for automatic changelog generation.


## Releasing

Changelog, version bump and tagging is done automatically by merging the release PR. See the [workflow](.github/workflows/release-please.yml).


- Optional: run `npm update` to update packages in package-lock.json. Not needed for every release.
- Optional: `npm outdated` and maybe bump more packages in package.json. Not needed for every release.
- run `run_manual_test.sh` and do some manual testing
- Run `vsce ls` and see if unneeded junk isn't being packaged
- Merge the Release PR if CI is green (you'll need to close and reopen it to trigger CI!)

## Publishing

After you did the release, go ahead and package:

- npm install && npm run compile && npm prune --production && vsce package
- (KDAB only) Go to https://marketplace.visualstudio.com/manage/publishers/KDAB and upload the *.vsix file
