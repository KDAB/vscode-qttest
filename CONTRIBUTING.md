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


## Install git-cliff

```bash
cargo install git-cliff
```

## Releasing

Get a version compatible with semver, run `git cliff --bump | head -n 5` and replace NEW_VERSION
export NEW_VERSION=1.0.0

- Optional: run `npm update` to update packages in package-lock.json. Not needed for every release.
- Optional: `npm outdated` and maybe bump more packages in package.json. Not needed for every release.
- run `run_manual_test.sh` and do some manual testing
- Run `vsce ls` and see if unneeded junk isn't being packaged
- Make sure Github Actions CI is green
- npm version $NEW_VERSION
- git cliff --tag ${NEW_VERSION} > CHANGELOG.md && git add CHANGELOG.md package.json package-lock.json && git commit -m "chore: bump version"
- npm install && npm run compile && npm prune --production && vsce package
- git tag -a v${NEW_VERSION} -m "v${NEW_VERSION}" && git push && git push --tags
- (KDAB only) Go to https://marketplace.visualstudio.com/manage/publishers/KDAB and upload the *.vsix file
