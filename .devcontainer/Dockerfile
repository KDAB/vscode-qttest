# SPDX-License-Identifier: MIT

# Instructions:
# docker build -t vscode-qttest .
# docker run -it -v /tmp/.X11-unix:/tmp/.X11-unix -v /data/sources/copilot/vscode-qttest/:/vscode-qttest/ --cap-add=SYS_PTRACE --security-opt seccomp=unconfined --ulimit nofile=1024:4096 -u 1000:1000 vscode-qttest
# cd /vscode-qttest/

FROM ubuntu:23.04
MAINTAINER Sergio Martins (sergio.martins@kdab.com)

ENV TZ=Europe/Berlin
ENV LC_CTYPE=C.UTF-8
ENV DISPLAY=:0

RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

## Installs node 18v
RUN apt update -qq && apt install build-essential software-properties-common lld git cmake ninja-build nodejs qtbase5-dev qt5-qmake libnss3-dev -y
RUN apt install npm -y

# Install tsc globally, for convenience
RUN npm install typescript -g

# These probably not needed, as project was already generated
# RUN npm install yo generator-code -g

RUN npm install @vscode/vsce -g

RUN apt install libasound2-dev -y
