
QT_BUILD_DIR=test/qt_test/build-dev/
VSCODE_DATA=test/qt_test/build-dev/vscode/

# Alias for debugging purposes, when needed
alias code_clean="code --user-data-dir $VSCODE_DATA --extensions-dir $VSCODE_DATA"

rm *vsix &> /dev/null
rm -rf BUILD_DIR &> /dev/null

npm install && npm run compile && npm prune --production && vsce package && \
cmake -S test/qt_test/ --preset=dev && \
cmake --build $QT_BUILD_DIR/ && \
code --install-extension qttests-*.vsix \
     --install-extension ms-vscode.cmake-tools \
     --install-extension vadimcn.vscode-lldb && \
code test/qt_test/vscode.code-workspace --crash-reporter-directory /tmp/
