// Static bracket / quote / comment balance checker for the single-file pages.
// Run with: node scan.cjs <file...>
//
// NOTE: verify.sh does everything this does *plus* the checks that actually
// matter for these files (stray </script> inside strings, missing $("#id")
// targets, duplicate ids, duplicate/orphan functions) and needs no Node:
//
//     sh standalone/verify.sh
//
// Keep this file only if you want a second, independent opinion on bracket
// balance; it understands string and comment context more precisely than the
// tr-based count in verify.sh.
const fs = require("fs");

function scan(name, src) {
  const stack = [];
  const pairs = { "}": "{", ")": "(", "]": "[" };
  let i = 0;
  let line = 1;
  let state = "code";
  const errors = [];

  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (c === "\n") line++;

    if (state === "code") {
      if (c === "/" && n === "/") { state = "line"; i += 2; continue; }
      if (c === "/" && n === "*") { state = "block"; i += 2; continue; }
      if (c === "'") { state = "sq"; i++; continue; }
      if (c === '"') { state = "dq"; i++; continue; }
      if (c === "`") { state = "tpl"; i++; continue; }
      if (c === "{" || c === "(" || c === "[") { stack.push({ c, line }); i++; continue; }
      if (c === "}" || c === ")" || c === "]") {
        const top = stack.pop();
        if (!top) errors.push(`line ${line}: stray '${c}'`);
        else if (top.c !== pairs[c]) errors.push(`line ${line}: '${c}' closes '${top.c}' opened on line ${top.line}`);
        i++;
        continue;
      }
      i++;
      continue;
    }
    if (state === "line") { if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (c === "*" && n === "/") { state = "code"; i += 2; continue; }
      i++;
      continue;
    }
    if (state === "sq" || state === "dq") {
      const q = state === "sq" ? "'" : '"';
      if (c === "\\") { i += 2; continue; }
      if (c === q) state = "code";
      i++;
      continue;
    }
    if (state === "tpl") {
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { state = "code"; i++; continue; }
      if (c === "$" && n === "{") { state = "code"; stack.push({ c: "${", line }); i += 2; continue; }
      i++;
      continue;
    }
  }

  if (state !== "code") errors.push(`unexpected end of file inside a ${state} literal`);
  if (stack.length) {
    errors.push("unclosed: " + stack.slice(0, 10).map((s) => `${s.c}@${s.line}`).join(", "));
  }
  return { name, errors };
}

const files = process.argv.slice(2);
let failed = false;
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const r = scan(f, src);
  if (r.errors.length) {
    failed = true;
    console.log(`FAIL ${f}`);
    for (const e of r.errors) console.log("  " + e);
  } else {
    console.log(`OK   ${f} (${src.split("\n").length} lines)`);
  }
}
process.exit(failed ? 1 : 0);