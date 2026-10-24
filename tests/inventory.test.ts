import assert from "node:assert/strict";
import test from "node:test";
import { parseInventoryData, prettifyId, stackMaxById } from "../src/lib/inventory";

test("parseInventoryData fills missing containers", () => {
  const data = parseInventoryData(
    JSON.stringify({ nickname: "Steve", containers: { main: [{ id: "minecraft:stone", count: 3 }] } })
  );
  assert.ok(data);
  assert.equal(data.containers.main.length, 36);
  assert.equal(data.containers.main[0]?.id, "minecraft:stone");
  assert.equal(data.containers.main[0]?.count, 3);
  assert.equal(data.containers.armor.length, 4);
  assert.equal(data.containers.enderChest.length, 27);
});

test("parseInventoryData normalizes stacks", () => {
  const data = parseInventoryData(
    JSON.stringify({
      nickname: "Steve",
      containers: {
        main: [{ id: "MINECRAFT:Diamond_Sword", count: -5, enchantments: [{ id: "minecraft:sharpness", lvl: 2.8 }] }],
      },
    })
  );
  assert.ok(data);
  const stack = data.containers.main[0];
  assert.equal(stack?.id, "minecraft:diamond_sword");
  assert.equal(stack?.count, 1);
  assert.equal(stack?.enchantments?.[0]?.lvl, 2);
});

test("parseInventoryData returns null for broken data", () => {
  assert.equal(parseInventoryData(null), null);
  assert.equal(parseInventoryData("not json"), null);
  assert.equal(parseInventoryData(JSON.stringify({})), null);
});

test("prettifyId and stack sizes", () => {
  assert.equal(prettifyId("minecraft:oak_log"), "Oak Log");
  assert.equal(stackMaxById("minecraft:ender_pearl"), 16);
  assert.equal(stackMaxById("minecraft:stone"), 64);
});
