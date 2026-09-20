import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const source = fs.readFileSync(
  path.join(currentDirectory, "station-card.js"),
  "utf8"
);
const context = { console };

vm.createContext(context);
vm.runInContext(source, context);

test("station fields are escaped before HTML interpolation", () => {
  const malicious = '<img src=x onerror="alert(1)">&\'';

  assert.equal(
    context.escapeStationHtml(malicious),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;"
  );
});

test("only finite coordinates are rendered into data attributes", () => {
  assert.equal(context.formatStationCoordinate(-37.8136), "-37.8136");
  assert.equal(context.formatStationCoordinate("javascript:alert(1)"), "");
});
