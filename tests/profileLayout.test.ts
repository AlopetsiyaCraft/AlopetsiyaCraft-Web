import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PROFILE_LAYOUT,
  normalizeProfileLayout,
  parseProfileLayout,
} from "../src/lib/profileLayout";

test("parseProfileLayout returns defaults for empty value", () => {
  const layout = parseProfileLayout("[]");
  assert.equal(layout.length, DEFAULT_PROFILE_LAYOUT.length);
  assert.deepEqual(layout[0], { id: "stats", visible: true, width: "full" });
});

test("parseProfileLayout ignores unknown blocks and duplicates", () => {
  const layout = parseProfileLayout(
    JSON.stringify([
      { id: "top", visible: false, width: "full" },
      { id: "top", visible: true, width: "half" },
      { id: "unknown", visible: true, width: "full" },
    ])
  );
  assert.equal(layout.filter((block) => block.id === "top").length, 1);
  assert.deepEqual(layout[0], { id: "top", visible: false, width: "full" });
  assert.ok(!layout.some((block) => (block.id as string) === "unknown"));
});

test("parseProfileLayout appends new blocks after saved ones", () => {
  const layout = parseProfileLayout(JSON.stringify([{ id: "audio", visible: true, width: "half" }]));
  assert.equal(layout[0].id, "audio");
  assert.equal(layout.length, DEFAULT_PROFILE_LAYOUT.length);
});

test("parseProfileLayout survives broken JSON", () => {
  const layout = parseProfileLayout("{not json");
  assert.equal(layout.length, DEFAULT_PROFILE_LAYOUT.length);
});

test("normalizeProfileLayout rejects non-arrays", () => {
  assert.equal(normalizeProfileLayout(null), null);
  assert.equal(normalizeProfileLayout("top"), null);
});

test("normalizeProfileLayout normalizes width and visibility", () => {
  const layout = normalizeProfileLayout([{ id: "radar", width: "weird", visible: 0 }]);
  assert.ok(layout);
  assert.deepEqual(layout[0], { id: "radar", visible: true, width: "half" });
});
