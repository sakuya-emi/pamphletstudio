#!/bin/zsh
cd "${0:A:h}"
if command -v node >/dev/null 2>&1; then
  studio_node="$(command -v node)"
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  studio_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  print 'Node.js 22以降をインストールし、npm install を実行してください。'
  read -k 1
  exit 1
fi
if [[ ! -f node_modules/vite/bin/vite.js ]]; then
  print '初回のみ、このフォルダで npm install を実行してください。'
  read -k 1
  exit 1
fi
print 'ブラウザで http://127.0.0.1:5173 を開いてください。終了は Control+C。'
exec "$studio_node" node_modules/vite/bin/vite.js --host 127.0.0.1
