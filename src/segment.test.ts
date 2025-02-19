import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { parseQuery, formatQuery, evaluateQuery } from "tool-query";

void suite("Child segments", () => {
  void test("should evaluate child segments", () => {
    const value = ["a", "b", "c", "d", "e", "f", "g"] as const;
    assert.deepEqual(evaluateQuery("$[0, 3]", value), ["a", "d"]);
    assert.deepEqual(evaluateQuery("$[0:2, 5]", value), ["a", "b", "f"]);
    assert.deepEqual(evaluateQuery("$[0, 0]", value), ["a", "a"]);
  });

  void test("should transcode child segments", () => {
    assert.equal(formatQuery(parseQuery("$[0, 3]")), "$[0, 3]");
    assert.equal(formatQuery(parseQuery("$[0:2, 5]")), "$[0:2, 5]");
    assert.equal(formatQuery(parseQuery("$[0, 0]")), "$[0, 0]");
  });
});

void suite("Descendant segments", () => {
  void test("should evaluate descendant segments", () => {
    const value = {
      o: { j: 1, k: 2 },
      a: [5, 3, [{ j: 4 }, { k: 6 }]],
    } as const;

    assert.deepEqual(evaluateQuery("$..j", value), [1, 4]);
    assert.deepEqual(evaluateQuery("$..[0]", value), [5, { j: 4 }]);
    assert.deepEqual(evaluateQuery("$..[*]", value), [
      { j: 1, k: 2 },
      [5, 3, [{ j: 4 }, { k: 6 }]],
      1,
      2,
      5,
      3,
      [{ j: 4 }, { k: 6 }],
      { j: 4 },
      { k: 6 },
      4,
      6,
    ]);
    assert.deepEqual(evaluateQuery("$..*", value), [
      { j: 1, k: 2 },
      [5, 3, [{ j: 4 }, { k: 6 }]],
      1,
      2,
      5,
      3,
      [{ j: 4 }, { k: 6 }],
      { j: 4 },
      { k: 6 },
      4,
      6,
    ]);
    assert.deepEqual(evaluateQuery("$..o", value), [{ j: 1, k: 2 }]);
    assert.deepEqual(evaluateQuery("$.o..[*, *]", value), [1, 2, 1, 2]);
    assert.deepEqual(evaluateQuery("$.a..[0, 1]", value), [
      5,
      3,
      { j: 4 },
      { k: 6 },
    ]);
  });

  void test("should transcode descendant segments", () => {
    assert.equal(formatQuery(parseQuery("$..j")), "$..j");
    assert.equal(formatQuery(parseQuery("$..[0]")), "$..[0]");
    assert.equal(formatQuery(parseQuery("$..[*]")), "$..*");
    assert.equal(formatQuery(parseQuery("$..*")), "$..*");
    assert.equal(formatQuery(parseQuery("$..o")), "$..o");
    assert.equal(formatQuery(parseQuery("$.o..[*, *]")), "$.o..[*, *]");
    assert.equal(formatQuery(parseQuery("$.a..[0, 1]")), "$.a..[0, 1]");
  });
});
