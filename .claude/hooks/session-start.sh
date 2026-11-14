#!/usr/bin/env bash
set -eo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
cd "$project_dir"

find_nvm() {
  local candidate
  for candidate in "${NVM_DIR:-}" /opt/nvm "$HOME/.nvm" /usr/local/nvm; do
    if [ -n "$candidate" ] && [ -s "$candidate/nvm.sh" ]; then
      printf '%s' "$candidate"
      return 0
    fi
  done
  return 1
}

node_bin=""
if nvm_dir="$(find_nvm)"; then
  export NVM_DIR="$nvm_dir"
  set +e
  # shellcheck source=/dev/null
  . "$NVM_DIR/nvm.sh"
  nvm install >/dev/null
  install_status=$?
  node_bin="$(dirname "$(nvm which current 2>/dev/null)")"
  set -e

  if [ "$install_status" -ne 0 ] || [ ! -x "$node_bin/node" ]; then
    node_bin=""
  fi
fi

if [ -n "$node_bin" ]; then
  export PATH="$node_bin:$PATH"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    printf 'export NVM_DIR=%q\n' "$NVM_DIR" >>"$CLAUDE_ENV_FILE"
    printf 'export PATH=%q:"$PATH"\n' "$node_bin" >>"$CLAUDE_ENV_FILE"
  fi
else
  echo "Could not select the Node version in .nvmrc ($(tr -d '[:space:]' <.nvmrc)); staying on $(node -v)." >&2
fi

install_ok=0
npm ci >/dev/null || install_ok=$?

if [ "$install_ok" -eq 0 ]; then
  echo "Node $(node -v) ready, dependencies installed."
else
  echo "npm ci failed on $(node -v). This repo needs the Node version in .nvmrc, which has Temporal built in." >&2
fi
