#!/bin/bash

tools_dir="$(cd "$(dirname "$0")" && pwd)"
base_dir="$tools_dir/../.."

for path in "$@"; do
  echo "checking blank entries in $path" 1>&2
  if cat "$path" |
       jq '. | to_entries | .[] | select(.value.message | not) | .key' -r |
       grep . >/dev/null; then
    cat "$path" |
      jq 'to_entries[] | select(.value.message)' |
      jq -s 'from_entries' > "${path}.fixed"
    "$tools_dir/escape-special-unicode-characters.sh" "${path}.fixed"
    mv "${path}.fixed" "$path"
    echo " => fixed" 1>&2
  fi;
done
