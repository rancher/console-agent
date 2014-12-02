#!/bin/bash

. ${CATTLE_HOME:-/var/lib/cattle}/common/scripts.sh

mkdir -p content-home/console-agent

cp -rf agent.js node_modules content-home/console-agent

stage_files

echo $RANDOM > $CATTLE_HOME/.pyagent-stamp
