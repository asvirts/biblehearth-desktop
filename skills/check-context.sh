#!/usr/bin/env bash
# Checks the rules marked `auto` in rules.md and the health of the agent memory.
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2

failures=0
fail() { echo "FAIL  $1"; failures=$((failures + 1)); }
ok() { echo "ok    $1"; }

memory="AGENTS.md CLAUDE.md rules.md $(ls decisions/*.md state/*.md gotchas/*.md logs/*.md skills/*.md 2>/dev/null | tr '\n' ' ')"

sensitive=$(git ls-files | grep -E '(^|/)\.env(\.[^/]*)?$|\.(key|p12|pfx|sqlite|db)$|(^|/)release(-config)?\.json$|backup.*\.json$' | grep -v '^\.env\.example$')
[ -z "$sensitive" ] && ok "R5 no sensitive files tracked" || fail "R5 tracked: $sensitive"

secrets=$(grep -rhoE 'VITE_[A-Z0-9_]+' src .env.example | grep -E 'SECRET|TOKEN|PRIVATE|PASSWORD' | sort -u)
[ -z "$secrets" ] && ok "R6 no secrets in VITE_ variables" || fail "R6 suspicious variables: $secrets"

dsn=$(grep -E '^(VITE_SENTRY_DSN|BIBLEHEARTH_SENTRY_DSN)=.+' .env.example)
upd=$(grep -E '^VITE_UPDATES_ENABLED=' .env.example | cut -d= -f2)
[ -z "$dsn" ] && [ "$upd" = "false" ] && ok "R7 Sentry and updater off in .env.example" || fail "R7 dsn='$dsn' updates='$upd'"

perms=$(grep -nE '"(fs|shell):' src-tauri/capabilities/*.json)
[ -z "$perms" ] && ok "R8 no fs or shell permissions" || fail "R8 $perms"

large=$(grep -oE 'page_size: *[0-9]+' src/platform/index.tsx | grep -oE '[0-9]+' | awk '$1 > 99')
[ -z "$large" ] && ok "R9 page_size <= 99" || fail "R9 page_size $large"

bibleapp=$(grep -rn "Bible App" src docs README.md)
[ -z "$bibleapp" ] && ok "R10 no 'Bible App'" || fail "R10 $bibleapp"

v_pkg=$(grep -m1 -E '"version"' package.json | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^"]*')
v_tauri=$(grep -m1 -E '"version"' src-tauri/tauri.conf.json | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^"]*')
v_cargo=$(grep -m1 -E '^version *=' src-tauri/Cargo.toml | grep -oE '[0-9]+\.[0-9]+\.[0-9]+[^"]*')
[ "$v_pkg" = "$v_tauri" ] && [ "$v_pkg" = "$v_cargo" ] && ok "R12 versions aligned ($v_pkg)" || fail "R12 package=$v_pkg tauri=$v_tauri cargo=$v_cargo"

updater=$(grep -nE 'latest\.json|"createUpdaterArtifacts": *true' .github/workflows/alpha-*.yml)
[ -z "$updater" ] && ok "R13 alpha without latest.json or updater artifacts" || fail "R13 $updater"

lines=$(wc -l < AGENTS.md | tr -d ' ')
[ "$lines" -le 300 ] && ok "R18 AGENTS.md has $lines lines" || fail "R18 AGENTS.md has $lines lines"
for log in logs/*.md; do
  n=$(wc -l < "$log" | tr -d ' ')
  [ "$n" -le 40 ] || fail "R18 $log has $n lines"
done

broken=0
for file in $memory; do
  dir=$(dirname "$file")
  for target in $(grep -oE '\]\([^)]+\)' "$file" | sed -E 's/^\]\(//; s/\)$//; s/#.*//'); do
    case "$target" in http*|mailto:*|"") continue ;; esac
    if [ ! -e "$dir/$target" ]; then
      fail "R19 $file links to $target, which does not exist"
      broken=$((broken + 1))
    fi
  done
done
[ "$broken" -eq 0 ] && ok "R19 internal memory links resolve"

if [ "$failures" -eq 0 ]; then echo "OK"; else echo "$failures failures"; exit 1; fi
