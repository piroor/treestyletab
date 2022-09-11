#!/bin/bash

ZWSP=$'\u200b'

if [ $# -lt 1 ]; then
  cat | sed -E -e "s/$ZWSP/\\\\u200b/g"
else
  sed -i -E -e "s/$ZWSP/\\\\u200b/g" "$@"
fi
