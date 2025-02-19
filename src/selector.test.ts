import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { parseQuery, formatQuery, evaluateQuery } from "tool-query";

void suite("Name selectors", () => {
  void test("should evaluate name selectors", () => {
    const value = {
      o: { "j j": { "k.k": 3 } },
      "'": { "@": 2 },
    } as const;

    assert.deepEqual(evaluateQuery("$.o['j j']", value), [{ "k.k": 3 }]);
    assert.deepEqual(evaluateQuery("$.o['j j']['k.k']", value), [3]);
    assert.deepEqual(evaluateQuery('$.o["j j"]["k.k"]', value), [3]);
    assert.deepEqual(evaluateQuery('$["\'"]["@"]', value), [2]);
  });

  void test("should transcode name selectors", () => {
    assert.equal(formatQuery(parseQuery("$.o['j j']")), "$.o['j j']");
    assert.equal(
      formatQuery(parseQuery("$.o['j j']['k.k']")),
      "$.o['j j']['k.k']",
    );
    assert.equal(
      formatQuery(parseQuery('$.o["j j"]["k.k"]')),
      "$.o['j j']['k.k']",
    );
    assert.equal(formatQuery(parseQuery('$["\'"]["@"]')), "$['\\'']['@']");
  });
});

void suite("Wildcard selectors", () => {
  void test("should evaluate wildcard selectors", () => {
    const value = {
      o: { j: 1, k: 2 },
      a: [5, 3],
    } as const;
    assert.deepEqual(evaluateQuery("$[*]", value), [{ j: 1, k: 2 }, [5, 3]]);
    assert.deepEqual(evaluateQuery("$.o[*]", value), [1, 2]);
    assert.deepEqual(evaluateQuery("$.o[*, *]", value), [1, 2, 1, 2]);
    assert.deepEqual(evaluateQuery("$.a[*]", value), [5, 3]);
  });

  void test("should transcode wildcard selectors", () => {
    assert.equal(formatQuery(parseQuery("$[*]")), "$.*");
    assert.equal(formatQuery(parseQuery("$.o[*]")), "$.o.*");
    assert.equal(formatQuery(parseQuery("$.o[*, *]")), "$.o[*, *]");
    assert.equal(formatQuery(parseQuery("$.a[*]")), "$.a.*");
  });
});

void suite("Index selectors", () => {
  void test("should evaluate index selectors", () => {
    const value = ["a", "b"] as const;
    assert.deepEqual(evaluateQuery("$[1]", value), ["b"]);
    assert.deepEqual(evaluateQuery("$[-2]", value), ["a"]);
  });

  void test("should transcode index selectors", () => {
    assert.equal(formatQuery(parseQuery("$[1]")), "$[1]");
    assert.equal(formatQuery(parseQuery("$[-2]")), "$[-2]");
  });
});

void suite("Slice selectors", () => {
  void test("should evaluate slice selectors", () => {
    const value = ["a", "b", "c", "d", "e", "f", "g"] as const;
    assert.deepEqual(evaluateQuery("$[1:3]", value), ["b", "c"]);
    assert.deepEqual(evaluateQuery("$[5:]", value), ["f", "g"]);
    assert.deepEqual(evaluateQuery("$[1:5:2]", value), ["b", "d"]);
    assert.deepEqual(evaluateQuery("$[5:1:-2]", value), ["f", "d"]);
    assert.deepEqual(evaluateQuery("$[::-1]", value), [
      "g",
      "f",
      "e",
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  void test("should transcode slice selectors", () => {
    assert.equal(formatQuery(parseQuery("$[1:3]")), "$[1:3]");
    assert.equal(formatQuery(parseQuery("$[5:]")), "$[5:]");
    assert.equal(formatQuery(parseQuery("$[1:5:2]")), "$[1:5:2]");
    assert.equal(formatQuery(parseQuery("$[5:1:-2]")), "$[5:1:-2]");
    assert.equal(formatQuery(parseQuery("$[::-1]")), "$[::-1]");
  });
});

void suite("Filter selectors", () => {
  void test("should evaluate filter selectors", () => {
    const value = {
      a: [3, 5, 1, 2, 4, 6, { b: "j" }, { b: "k" }, { b: {} }, { b: "kilo" }],
      o: { p: 1, q: 2, r: 3, s: 5, t: { u: 6 } },
      e: "f",
    } as const;

    assert.deepEqual(evaluateQuery("$.a[?@.b == 'kilo']", value), [
      { b: "kilo" },
    ]);
    assert.deepEqual(evaluateQuery("$.a[?(@.b == 'kilo')]", value), [
      { b: "kilo" },
    ]);
    assert.deepEqual(evaluateQuery("$.a[?@>3.5]", value), [5, 4, 6]);
    assert.deepEqual(evaluateQuery("$.a[?@.b]", value), [
      { b: "j" },
      { b: "k" },
      { b: {} },
      { b: "kilo" },
    ]);
    assert.deepEqual(evaluateQuery("$[?@.*]", value), [
      [3, 5, 1, 2, 4, 6, { b: "j" }, { b: "k" }, { b: {} }, { b: "kilo" }],
      { p: 1, q: 2, r: 3, s: 5, t: { u: 6 } },
    ]);
    assert.deepEqual(evaluateQuery("$[?@[?@.b]]", value), [
      [3, 5, 1, 2, 4, 6, { b: "j" }, { b: "k" }, { b: {} }, { b: "kilo" }],
    ]);
    assert.deepEqual(evaluateQuery("$.o[?@<3, ?@<3]", value), [1, 2, 1, 2]);
    assert.deepEqual(evaluateQuery('$.a[?@<2 || @.b == "k"]', value), [
      1,
      { b: "k" },
    ]);
    assert.deepEqual(evaluateQuery('$.a[?match(@.b, "[jk]")]', value), [
      { b: "j" },
      { b: "k" },
    ]);
    assert.deepEqual(evaluateQuery('$.a[?search(@.b, "[jk]")]', value), [
      { b: "j" },
      { b: "k" },
      { b: "kilo" },
    ]);
    assert.deepEqual(evaluateQuery("$.o[?@>1 && @<4]", value), [2, 3]);
    assert.deepEqual(evaluateQuery("$.o[?@.u || @.x]", value), [{ u: 6 }]);
    assert.deepEqual(
      evaluateQuery("$.a[?@.b == $.x]", value),
      [3, 5, 1, 2, 4, 6],
    );
    assert.deepEqual(evaluateQuery("$.a[?@ == @]", value), [
      3,
      5,
      1,
      2,
      4,
      6,
      { b: "j" },
      { b: "k" },
      { b: {} },
      { b: "kilo" },
    ]);
  });

  void test("should transcode filter selectors", () => {
    assert.equal(
      formatQuery(parseQuery("$.a[?@.b == 'kilo']")),
      "$.a[?@.b == 'kilo']",
    );
    assert.equal(
      formatQuery(parseQuery("$.a[?(@.b == 'kilo')]")),
      "$.a[?@.b == 'kilo']",
    );
    assert.equal(formatQuery(parseQuery("$.a[?@>3.5]")), "$.a[?@ > 3.5]");
    assert.equal(formatQuery(parseQuery("$.a[?@.b]")), "$.a[?@.b]");
    assert.equal(formatQuery(parseQuery("$[?@.*]")), "$[?@.*]");
    assert.equal(formatQuery(parseQuery("$[?@[?@.b]]")), "$[?@[?@.b]]");
    assert.equal(
      formatQuery(parseQuery("$.o[?@<3, ?@<3]")),
      "$.o[?@ < 3, ?@ < 3]",
    );
    assert.equal(
      formatQuery(parseQuery('$.a[?@<2 || @.b == "k"]')),
      "$.a[?@ < 2 || @.b == 'k']",
    );
    assert.equal(
      formatQuery(parseQuery('$.a[?match(@.b, "[jk]")]')),
      "$.a[?match(@.b, '[jk]')]",
    );
    assert.equal(
      formatQuery(parseQuery('$.a[?search(@.b, "[jk]")]')),
      "$.a[?search(@.b, '[jk]')]",
    );
    assert.equal(
      formatQuery(parseQuery("$.o[?@>1 && @<4]")),
      "$.o[?@ > 1 && @ < 4]",
    );
    assert.equal(
      formatQuery(parseQuery("$.o[?@.u || @.x]")),
      "$.o[?@.u || @.x]",
    );
    assert.equal(
      formatQuery(parseQuery("$.a[?@.b == $.x]")),
      "$.a[?@.b == $.x]",
    );
    assert.equal(formatQuery(parseQuery("$.a[?@ == @]")), "$.a[?@ == @]");
  });
});
