import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(join(root, "src/game/gateMath.ts"), "utf8");
const outDir = "/tmp/crew-count-clash-tests";
const outFile = join(outDir, "gateMath.mjs");
await mkdir(outDir, { recursive: true });
const output = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove
  }
}).outputText;
await writeFile(outFile, output);

const { calculateGateCount } = await import(pathToFileURL(outFile).href);

const cases = [
  ["add", 10, "add", 5, 0, 15],
  ["add bonus", 10, "add", 5, 2, 19],
  ["subtract floor", 10, "subtract", 15, 0, 0],
  ["multiply bonus", 7, "multiply", 3, 2, 23],
  ["divide ceiling", 17, "divide", 4, 0, 5],
  ["divide guard", 12, "divide", 0, 0, 12],
  ["percent gain", 20, "percent", 50, 0, 30],
  ["percent loss", 100, "percent", -40, 0, 60],
  ["percent bonus", 10, "percent", 20, 2, 13]
];

for (const [name, count, op, value, bonus, expected] of cases) {
  const actual = calculateGateCount(count, op, value, bonus);
  if (actual !== expected) {
    throw new Error(`${name}: expected ${expected}, got ${actual}`);
  }
}

console.log("Gate math check passed.");
