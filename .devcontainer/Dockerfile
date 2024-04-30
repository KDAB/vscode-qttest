# SPDX-License-Identifier: MIT

# Instructions:
# docker build -t vscode-qttest .
# docker run -it -v /tmp/.X11-unix:/tmp/.X11-unix -v /data/sources/copilot/vscode-qttest/:/vscode-qttest/ --cap-add=SYS_PTRACE --security-opt seccomp=unconfined --ulimit nofile=1024:4096 -u 1000:1000 vscode-qttest
# cd /vscode-qttest/

FROM ubuntu:24.04

ENV TZ=Europe/Berlin
ENV LC_CTYPE=C.UTF-8
ENV DISPLAY=:0

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

## Installs node 18v
RUN apt update -qq && apt install build-essential software-properties-common lld git \
    cmake ninja-build nodejs qtbase5-dev qt5-qmake libnss3-dev wget gdebi-core libdbus-glib-1-2 \
    libssl-dev openssl npm libasound2-dev curl \
    libsecret-1-dev lsof shared-mime-info libxss-dev libxkbfile-dev libnotify-dev \
    -y

# Install tsc globally, for convenience
RUN npm install typescript -g

# Useful to symbolize minidumps in case vscode crashes
RUN npm install electron-minidump -g

RUN npm install @vscode/vsce -g

RUN wget -O code.deb https://go.microsoft.com/fwlink/?LinkID=760868
RUN gdebi code.deb -n

WORKDIR /vscode-qttest
