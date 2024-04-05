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

TODO


## Install git-cliff

```bash
cargo install git-cliff
```

## Releasing

(Replace 1.0.0 with actual version used)

- Make sure Github Actions CI is green
- Run `vsce ls` and see if unneeded junk isn't being packaged
- Optional: To get a version compatible with semver, run `git cliff --bump`
- Increase version in package.json and package-lock.json.
- git cliff --tag 1.0.0 > Changelog
- git add Changelog package.json package-lock.json && git commit -m "chore: bump version"
- npm install && npm run compile && npm prune --production && vsce package
- git tag -a v1.0.0 -m 'v1.0.0'
- git push --tags
- vsce publish
