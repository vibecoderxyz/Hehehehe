#!/bin/sh
# verify.sh — dependency-free integrity check for the single-file pages.
#
#   sh standalone/verify.sh                      # checks both pages
#   sh standalone/verify.sh standalone/index.html
#
# Needs only POSIX sh + grep/sed/sort/comm/tr/wc, so it runs on a phone, a
# minimal container or a CI box without Node. Exits 0 when everything passes.
#
# What it catches (all of these have actually broken this project before):
#   * a stray </script> inside a JS string, which silently truncates the app
#   * unbalanced brackets / unterminated strings in the inlined script
#   * a $("#id") lookup with no matching element (dead button, silent no-op)
#   * duplicate element ids
#   * a function defined twice, or defined but never called

set -u

tmp="$(dirname "$0")/.verify.tmp"
rm -rf "$tmp"
mkdir -p "$tmp" || exit 1
trap 'rm -rf "$tmp"' EXIT HUP INT TERM

fails=0
fail() { printf '  FAIL  %s\n' "$*"; fails=$((fails + 1)); }
ok()   { printf '  ok    %s\n' "$*"; }
note() { printf '%s\n' "$*"; }

# ---------------------------------------------------------------- extract ----
# Split the file into "script body" and "markup" so checks can target each.
extract() { # $1=file  $2=out-prefix
  _f=$1; _o=$2
  _start=$(grep -n '^<script>$' "$_f" | head -1 | cut -d: -f1)
  _end=$(grep -n '^</script>$' "$_f" | head -1 | cut -d: -f1)

  if [ -z "$_start" ] || [ -z "$_end" ] || [ "$_end" -le "$_start" ]; then
    return 1
  fi
  _first=$((_start + 1))
  _last=$((_end - 1))
  sed -n "${_first},${_last}p" "$_f" > "$_o.js"
  # markup = everything outside the script block
  sed -n "1,${_start}p" "$_f" >  "$_o.html"
  sed -n "${_end},\$p" "$_f" >> "$_o.html"
  return 0
}

# ------------------------------------------------------------ per-file check --
check_file() {
  f=$1
  note ""
  note "== $f"

  [ -f "$f" ] || { fail "no such file"; return; }

  # 1. exactly one script block, opened and closed at column 0
  opens=$(grep -c '^<script>$' "$f")
  closes=$(grep -c '^</script>$' "$f")
  if [ "$opens" -eq 1 ] && [ "$closes" -eq 1 ]; then
    ok "single <script> block"
  else
    fail "expected 1 <script> and 1 </script> line, found $opens / $closes"
  fi

  # 2. no closing tag may appear *anywhere* else — the classic truncation trap
  all_o=$(grep -c '<script' "$f")
  all_c=$(grep -c '</script' "$f")
  if [ "$all_o" -eq 1 ] && [ "$all_c" -eq 1 ]; then
    ok "no stray <script>/</script> in strings"
  else
    fail "literal <script> ($all_o) or </script> ($all_c) appears inside JS strings"
    note "        (the page would be truncated — build tags from fragments)"
  fi

  base="$tmp/$(basename "$f" .html)"
  if ! extract "$f" "$base"; then
    fail "could not locate the script block"
    return
  fi

  # 3. bracket balance of the script body.
  # Counted with a quote- and regex-aware scan, not `tr`: this codebase has
  # strings like "(MediaTek Dimensity 9300)" and regexes like /\s*(?:\(TM\))?/
  # whose brackets are not code, and a naive count reports them as unbalanced.
  bal=$(awk -f "$(dirname "$0")/.balance.awk" "$base.js" 2>&1)
  case "$bal" in
    UNTERMINATED*)
      fail "script body ends inside an unterminated literal ($bal)"
      ;;
    *" "*)
      set -- $bal
      for pair in "() $1 $2" "{} $3 $4" "[] $5 $6"; do
        set -- $pair
        if [ "$2" -eq "$3" ]; then
          ok "balanced $1 ($2)"
        else
          fail "unbalanced $1 — $2 open vs $3 close"
        fi
      done
      ;;
    *)
      fail "bracket scan failed: $bal"
      ;;
  esac

  # 4. duplicate ids
  grep -o 'id="[a-zA-Z0-9_-]*"' "$base.html" \
    | sed 's/id="//; s/"$//' | sort > "$base.ids"
  dupes=$(sort "$base.ids" | uniq -d | tr '\n' ' ')
  if [ -z "$dupes" ]; then
    ok "no duplicate element ids"
  else
    fail "duplicate ids: $dupes"
  fi

  # 5. every $("#id") resolves to a real element
  grep -oE '\$\("#[A-Za-z0-9_-]+"\)' "$base.js" \
    | sed 's/\$("#//; s/")$//' | sort -u > "$base.used"
  missing=$(comm -23 "$base.used" "$base.ids" | tr '\n' ' ')
  if [ -z "$missing" ]; then
    n=$(wc -l < "$base.used" | tr -d ' ')
    t=$(wc -l < "$base.ids" | tr -d ' ')
    ok "all $n \$(\"#id\") lookups resolve (of $t ids)"
  else
    fail "lookup with no element: $missing"
  fi

  # 6. functions: defined once, called at least once
  grep -oE 'function [A-Za-z0-9_]+' "$base.js" \
    | sed 's/function //' | sort | uniq -c > "$base.fncount"
  redefined=$(awk '$1 > 1 { print $2 }' "$base.fncount" | tr '\n' ' ')
  if [ -z "$redefined" ]; then
    ok "no function defined twice"
  else
    fail "function defined more than once: $redefined"
  fi

  uncalled=""
  while read -r count name; do
    # Direct calls, plus bare identifier references so callbacks passed by
    # reference — e.g. `Promise.all(tasks).then(tick)` — are not false alarms.
    # Each definition line matches exactly one of the two patterns, so a
    # function with no caller at all scores a combined 1.
    calls=$(grep -oE "(^|[^A-Za-z0-9_.])${name}[[:space:]]*\(" "$base.js" | wc -l | tr -d ' ')
    refs=$(grep -oE "(^|[^A-Za-z0-9_.\$])${name}([^A-Za-z0-9_(]|$)" "$base.js" | wc -l | tr -d ' ')
    if [ $((calls + refs)) -le 1 ]; then
      uncalled="$uncalled $name"
    fi
  done < "$base.fncount"
  if [ -z "$uncalled" ]; then
    n=$(wc -l < "$base.fncount" | tr -d ' ')
    ok "all $n functions are called at least once"
  else
    fail "defined but never called:$uncalled"
  fi
}

# ------------------------------------------------------------------- main ----
if [ "$#" -gt 0 ]; then
  files="$*"
else
  here=$(dirname "$0")
  files="$here/index.html $here/gateway.html"
fi

for f in $files; do
  check_file "$f"
done

note ""
if [ "$fails" -eq 0 ]; then
  note "PASS — no problems found."
  exit 0
fi
note "FAIL — $fails problem(s)."
exit 1