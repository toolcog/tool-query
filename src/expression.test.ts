import assert from "node:assert/strict";
import { suite, test } from "node:test";
import type {
  ExpressionType,
  LogicalType,
  NodesType,
  LogicalFunctionExtension,
  NodesFunctionExtension,
} from "tool-query";
import { QueryError, DeclaredType, parseQuery, formatQuery } from "tool-query";

void suite("Function expressions", () => {
  const fooFunction = {
    name: "foo",
    parameterTypes: [DeclaredType.Nodes],
    resultType: DeclaredType.Nodes,
    evaluate(args: readonly ExpressionType[]): NodesType {
      throw new Error("Never called");
    },
  } as const satisfies NodesFunctionExtension;

  const barFunction = {
    name: "bar",
    parameterTypes: [DeclaredType.Value],
    resultType: DeclaredType.Logical,
    evaluate(args: readonly ExpressionType[]): LogicalType {
      throw new Error("Never called");
    },
  } as const satisfies LogicalFunctionExtension;

  const bnlFunction = {
    name: "bnl",
    parameterTypes: [DeclaredType.Nodes],
    resultType: DeclaredType.Logical,
    evaluate(args: readonly ExpressionType[]): LogicalType {
      throw new Error("Never called");
    },
  } as const satisfies LogicalFunctionExtension;

  const bltFunction = {
    name: "blt",
    parameterTypes: [DeclaredType.Logical],
    resultType: DeclaredType.Logical,
    evaluate(args: readonly ExpressionType[]): LogicalType {
      throw new Error("Never called");
    },
  } as const satisfies LogicalFunctionExtension;

  const balFunction = {
    name: "bal",
    parameterTypes: [DeclaredType.Value],
    resultType: DeclaredType.Logical,
    evaluate(args: readonly ExpressionType[]): LogicalType {
      throw new Error("Never called");
    },
  } as const satisfies LogicalFunctionExtension;

  const options = {
    functionExtensions: {
      [fooFunction.name]: fooFunction,
      [barFunction.name]: barFunction,
      [bnlFunction.name]: bnlFunction,
      [bltFunction.name]: bltFunction,
      [balFunction.name]: balFunction,
    },
  } as const;

  void test("should transcode function expressions", () => {
    assert.equal(
      formatQuery(parseQuery("$[?length(@) < 3]")),
      "$[?length(@) < 3]",
    );
    assert.equal(
      formatQuery(parseQuery("$[?count(@.*) == 1]")),
      "$[?count(@.*) == 1]",
    );
    assert.equal(
      formatQuery(parseQuery("$[?count(foo(@.*)) == 1]", options)),
      "$[?count(foo(@.*)) == 1]",
    );
    assert.equal(
      formatQuery(parseQuery("$[?match(@.timezone, 'Europe/.*')]")),
      "$[?match(@.timezone, 'Europe/.*')]",
    );
    assert.equal(
      formatQuery(parseQuery('$[?value(@..color) == "red"]')),
      "$[?value(@..color) == 'red']",
    );
    assert.equal(
      formatQuery(parseQuery("$[?bar(@.a)]", options)),
      "$[?bar(@.a)]",
    );
    assert.equal(
      formatQuery(parseQuery("$[?bnl(@.*)]", options)),
      "$[?bnl(@.*)]",
    );
    assert.equal(
      formatQuery(parseQuery("$[?blt(1==1)]", options)),
      "$[?blt(1 == 1)]",
    );
    assert.equal(formatQuery(parseQuery("$[?bal(1)]", options)), "$[?bal(1)]");
  });

  void test("should fail to parse not well-typed function expressions", () => {
    assert.throws(() => parseQuery("$[?length(@.*) < 3]"), QueryError);
    assert.throws(() => parseQuery("$[?count(1) == 1]"), QueryError);
    assert.throws(
      () => parseQuery("$[?match(@.timezone, 'Europe/.*') == true]"),
      QueryError,
    );
    assert.throws(() => parseQuery("$[?value(@..color)]"), QueryError);
    assert.throws(() => parseQuery("$[?blt(1)]"), QueryError);
  });
});
