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

(Replace 1.0.0 with actual version used)

- Make sure Github Actions CI is green
- run `npm update` to update packages in package-lock.json
- Run `vsce ls` and see if unneeded junk isn't being packaged
- Optional: To get a version compatible with semver, run `git cliff --bump`
- Increase version in package.json and package-lock.json.
- git cliff --tag 1.0.0 > Changelog
- git add Changelog package.json package-lock.json && git commit -m "chore: bump version"
- npm install && npm run compile && npm prune --production && vsce package
- git tag -a v1.0.0 -m 'v1.0.0'
- git push --tags
- Go to   https://marketplace.visualstudio.com/manage/publishers/sergiokdab and upload the *.vsix file
