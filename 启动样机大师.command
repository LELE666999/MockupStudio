#!/bin/zsh
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}"
if [[ ! -f offline/index.html ]]; then
  print '正在生成本地网页版，仅首次需要编译。'
  if [[ ! -d node_modules ]]; then npm ci; fi
  npm run build:offline
fi
entry="${PWD}/../3D样机大师.html"
if [[ ! -f "$entry" ]]; then entry="${PWD}/offline/index.html"; fi
open -a 'Google Chrome' "$entry" || open "$entry"
