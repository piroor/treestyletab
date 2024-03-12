#!/bin/bash

if [ $# -lt 1 ]; then
  cat | sed -E -e "s/\"\"/\"\\\\u200b\"/g"
else
  sed -i -E -e "s/\"\"/\"\\\\u200b\"/g" "$@"
fi
