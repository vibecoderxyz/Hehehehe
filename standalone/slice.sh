#!/bin/sh
# slice.sh <file> <marker> <before> <after> [maxhits]
# Print a bounded window around each occurrence of <marker> in <file>.
# Exists because the reference bundles are single enormous lines, so
# line-based tools (sed -n 'Np') are useless and unbounded extraction
# blows the context window.
f=$1; m=$2; b=${3:-200}; a=${4:-1200}; max=${5:-3}
awk -v m="$m" -v b="$b" -v a="$a" -v max="$max" '
  BEGIN { n = 0; R = length(m) }
  {
    start = 1
    while (n < max) {
      i = index(substr($0, start), m)
      if (i == 0) break
      i = start + i - 1
      s = i - b; if (s < 1) s = 1
      printf "---- hit %d @ col %d ----\n", n + 1, i
      print substr($0, s, (i - s) + R + a)
      print ""
      n = n + 1
      start = i + R
    }
  }
  END { if (n == 0) print "(no match for: " m ")" }
' "$f"
