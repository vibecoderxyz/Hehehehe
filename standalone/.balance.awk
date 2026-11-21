# Quote-, comment- and regex-aware bracket counter for a JS body on stdin.
# Prints:  openParen closeParen openBrace closeBrace openBracket closeBracket
#
# A naive `tr -cd '('` count is wrong for this codebase three times over:
#   1. string literals such as "(MediaTek Dimensity 9300)" hold unbalanced brackets;
#   2. regex literals such as /\s*(?:\(TM\))?\s*(\d+)/ hold them too;
#   3. comments may contain anything at all.
# This walks the source with a small state machine instead.
#
# Regex literals are detected with the usual heuristic: a `/` starts a regex when
# the previous significant character cannot end a value (after `(`, `=`, `,`,
# `return`, `typeof`, …). Division (`a / b`) is therefore still treated as code.
#
# Limitation: `${...}` inside a template literal is opaque, so brackets inside an
# interpolation are not counted. These pages avoid template literals for that
# reason; standalone/scan.cjs does full nesting if you need a second opinion.
BEGIN {
  state = "code"; op = 0; cl = 0; ob = 0; cb = 0; os = 0; cs = 0
  prev = ""          # last significant char seen in code state
  prevWord = ""      # last identifier-ish token, for `return /re/`
}
{
  n = length($0)
  i = 1
  while (i <= n) {
    c = substr($0, i, 1)
    d = substr($0, i + 1, 1)

    if (state == "line") { i = n + 1; continue }

    if (state == "block") {
      if (c == "*" && d == "/") { state = "code"; i += 2; continue }
      i++; continue
    }

    if (state == "regex") {
      if (c == "\\") { i += 2; continue }
      if (c == "[") { inClass = 1; i++; continue }
      if (c == "]") { inClass = 0; i++; continue }
      if (c == "/" && !inClass) {
        state = "code"; prev = "/"; i++
        continue
      }
      i++; continue
    }

    if (state == "dq" || state == "sq") {
      q = (state == "dq") ? "\"" : "'"
      if (c == "\\") { i += 2; continue }
      if (c == q) { state = "code"; prev = "x"; i++; continue }
      i++; continue
    }

    if (state == "tpl") {
      if (c == "\\") { i += 2; continue }
      if (c == "`") { state = "code"; prev = "x"; i++; continue }
      i++; continue
    }

    # ---- state == "code" ----
    if (c == "/" && d == "/") { i = n + 1; continue }
    if (c == "/" && d == "*") { state = "block"; i += 2; continue }

    if (c == "/") {
      # Decide: regex literal or division?
      isRegex = 0
      if (prev == "") isRegex = 1
      else if (index("(,=:[!&|?{};+-*%~^<>", prev) > 0) isRegex = 1
      else if (prevWord == "return" || prevWord == "typeof" || prevWord == "case" \
            || prevWord == "in" || prevWord == "of" || prevWord == "new" \
            || prevWord == "delete" || prevWord == "void" || prevWord == "instanceof" \
            || prevWord == "do" || prevWord == "else") isRegex = 1
      if (isRegex) { state = "regex"; inClass = 0; i++; continue }
      prev = "/"; prevWord = ""; i++; continue
    }

    if (c == "\"") { state = "dq"; i++; continue }
    if (c == "'") { state = "sq"; i++; continue }
    if (c == "`") { state = "tpl"; i++; continue }

    if (c == "(") { op++; prev = "("; prevWord = ""; i++; continue }
    if (c == ")") { cl++; prev = ")"; prevWord = ""; i++; continue }
    if (c == "{") { ob++; prev = "{"; prevWord = ""; i++; continue }
    if (c == "}") { cb++; prev = "}"; prevWord = ""; i++; continue }
    if (c == "[") { os++; prev = "["; prevWord = ""; i++; continue }
    if (c == "]") { cs++; prev = "]"; prevWord = ""; i++; continue }

    if (c ~ /[A-Za-z_$]/) {
      w = ""
      while (i <= n && substr($0, i, 1) ~ /[A-Za-z0-9_$]/) { w = w substr($0, i, 1); i++ }
      prevWord = w; prev = "x"
      continue
    }
    if (c !~ /[ \t\r]/) { prev = c; if (c !~ /[0-9]/) prevWord = "" }
    i++
  }
}
END {
  if (state != "code") {
    printf "UNTERMINATED %s\n", state
    exit 2
  }
  printf "%d %d %d %d %d %d\n", op, cl, ob, cb, os, cs
}