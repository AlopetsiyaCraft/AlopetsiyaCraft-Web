import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDistanceCm,
  formatStatValue,
  getStatCategory,
} from "../src/lib/stats";

test("formatDistanceCm switches units", () => {
  assert.equal(formatDistanceCm(0), "0 м");
  assert.equal(formatDistanceCm(123), "1 м");
  assert.equal(formatDistanceCm(98_400), "984 м");
  assert.equal(formatDistanceCm(1_234_500), "12.3 км");
});

test("formatStatValue formats play time as hours", () => {
  const category = getStatCategory("play_time");
  assert.ok(category);
  assert.equal(formatStatValue(category, 72_000), "1 ч");
  assert.equal(formatStatValue(category, 0), "0 ч");
});

test("formatStatValue keeps raw numbers", () => {
  const category = getStatCategory("deaths");
  assert.ok(category);
  assert.equal(formatStatValue(category, 42), "42");
});

test("getStatCategory returns undefined for unknown key", () => {
  assert.equal(getStatCategory("nope"), undefined);
});
