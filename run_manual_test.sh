
QT_BUILD_DIR=test/qt_test/build-dev/

rm *vsix &> /dev/null
rm -rf BUILD_DIR &> /dev/null

npm install && npm run compile && npm prune --production && vsce package && \
cmake -S test/qt_test/ --preset=dev && \
cmake --build $QT_BUILD_DIR/ && \
code --install-extension qttest-0.3.0.vsix \
     --install-extension ms-vscode.cmake-tools \
     --install-extension vadimcn.vscode-lldb && \
code test/qt_test/
