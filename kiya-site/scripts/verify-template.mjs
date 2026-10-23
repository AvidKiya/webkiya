import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const manifest = JSON.parse(readFileSync("template-manifest.json"));
for (const [path, expected] of Object.entries(manifest)) {
  const hash = createHash("sha256")
    .update(readFileSync("template-original/" + path))
    .digest("hex");
  if (hash !== expected) throw new Error("Original template modified: " + path);
}
console.log(
  "PASS: original template preserved byte-for-byte (" +
    Object.keys(manifest).length +
    " files).",
);
