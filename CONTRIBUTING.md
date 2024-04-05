# Tips for contributors

## Prepare your development environment

Just follow `.devcontainer/Dockerfile` to see what's needed.<br?>


## Running tests

TODO


## Install git-cliff

```bash
cargo install git-cliff
```

## Releasing

(Replace 1.0.0 with actual version used)

- Make sure Github Actions CI is green
- Optional: To get a version compatible with semver, run `git cliff --bump`
- Increase version in package.json and package-lock.json.
- git cliff --tag 1.0.0 > Changelog
- git add Changelog package.json package-lock.json && git commit -m "chore: bump version"
- git tag -a v1.0.0 -m 'v1.0.0'
- git push --tags
- vsce package
- vsce publish
