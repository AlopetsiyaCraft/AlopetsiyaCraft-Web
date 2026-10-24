import assert from "node:assert/strict";
import test from "node:test";
import { feeFor, marketItemKey, MARKET_FEE_PERCENT } from "../src/lib/market";

test("market fee is 5 percent", () => {
  assert.equal(MARKET_FEE_PERCENT, 5);
  assert.equal(feeFor(100), 5);
  assert.equal(feeFor(40), 2);
  assert.equal(feeFor(10), 1);
  assert.equal(feeFor(1), 0);
});

test("market item key is normalized", () => {
  assert.equal(marketItemKey("  Minecraft:Diamond_Sword "), "minecraft:diamond_sword");
});
