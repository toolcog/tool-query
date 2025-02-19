import assert from "node:assert/strict";
import { suite, test } from "node:test";
import { parseQuery, formatQuery, evaluateQuery } from "tool-query";

void suite("JSONPath queries", () => {
  void test("evaluates root identifiers", () => {
    assert.deepEqual(evaluateQuery("$", { k: "v" }), [{ k: "v" }]);
  });

  void test("transcodes root identifiers", () => {
    assert.equal(formatQuery(parseQuery("$")), "$");
  });

  void test("evaluates query expressions", () => {
    const value = {
      store: {
        book: [
          {
            category: "reference",
            author: "Nigel Rees",
            title: "Sayings of the Century",
            price: 8.95,
          },
          {
            category: "fiction",
            author: "Evelyn Waugh",
            title: "Sword of Honour",
            price: 12.99,
          },
          {
            category: "fiction",
            author: "Herman Melville",
            title: "Moby Dick",
            isbn: "0-553-21311-3",
            price: 8.99,
          },
          {
            category: "fiction",
            author: "J. R. R. Tolkien",
            title: "The Lord of the Rings",
            isbn: "0-395-19395-8",
            price: 22.99,
          },
        ],
        bicycle: {
          color: "red",
          price: 399,
        },
      },
    } as const;

    assert.deepEqual(evaluateQuery("$.store.book[*].author", value), [
      "Nigel Rees",
      "Evelyn Waugh",
      "Herman Melville",
      "J. R. R. Tolkien",
    ]);
    assert.deepEqual(evaluateQuery("$..author", value), [
      "Nigel Rees",
      "Evelyn Waugh",
      "Herman Melville",
      "J. R. R. Tolkien",
    ]);
    assert.deepEqual(evaluateQuery("$.store.*", value), [
      [
        {
          author: "Nigel Rees",
          category: "reference",
          price: 8.95,
          title: "Sayings of the Century",
        },
        {
          author: "Evelyn Waugh",
          category: "fiction",
          price: 12.99,
          title: "Sword of Honour",
        },
        {
          author: "Herman Melville",
          category: "fiction",
          isbn: "0-553-21311-3",
          price: 8.99,
          title: "Moby Dick",
        },
        {
          author: "J. R. R. Tolkien",
          category: "fiction",
          isbn: "0-395-19395-8",
          price: 22.99,
          title: "The Lord of the Rings",
        },
      ],
      {
        color: "red",
        price: 399,
      },
    ]);
    assert.deepEqual(
      evaluateQuery("$.store..price", value),
      [8.95, 12.99, 8.99, 22.99, 399],
    );
    assert.deepEqual(evaluateQuery("$..book[2]", value), [
      {
        author: "Herman Melville",
        category: "fiction",
        isbn: "0-553-21311-3",
        price: 8.99,
        title: "Moby Dick",
      },
    ]);
    assert.deepEqual(evaluateQuery("$..book[2].author", value), [
      "Herman Melville",
    ]);
    assert.deepEqual(evaluateQuery("$..book[2].publisher", value), []);
    assert.deepEqual(evaluateQuery("$..book[-1]", value), [
      {
        author: "J. R. R. Tolkien",
        category: "fiction",
        isbn: "0-395-19395-8",
        price: 22.99,
        title: "The Lord of the Rings",
      },
    ]);
    assert.deepEqual(evaluateQuery("$..book[0,1]", value), [
      {
        author: "Nigel Rees",
        category: "reference",
        price: 8.95,
        title: "Sayings of the Century",
      },
      {
        author: "Evelyn Waugh",
        category: "fiction",
        price: 12.99,
        title: "Sword of Honour",
      },
    ]);
    assert.deepEqual(evaluateQuery("$..book[:2]", value), [
      {
        author: "Nigel Rees",
        category: "reference",
        price: 8.95,
        title: "Sayings of the Century",
      },
      {
        author: "Evelyn Waugh",
        category: "fiction",
        price: 12.99,
        title: "Sword of Honour",
      },
    ]);
    assert.deepEqual(evaluateQuery("$..book[?@.isbn]", value), [
      {
        author: "Herman Melville",
        category: "fiction",
        isbn: "0-553-21311-3",
        price: 8.99,
        title: "Moby Dick",
      },
      {
        author: "J. R. R. Tolkien",
        category: "fiction",
        isbn: "0-395-19395-8",
        price: 22.99,
        title: "The Lord of the Rings",
      },
    ]);
    assert.deepEqual(evaluateQuery("$..book[?@.price<10]", value), [
      {
        author: "Nigel Rees",
        category: "reference",
        price: 8.95,
        title: "Sayings of the Century",
      },
      {
        author: "Herman Melville",
        category: "fiction",
        isbn: "0-553-21311-3",
        price: 8.99,
        title: "Moby Dick",
      },
    ]);
    assert.deepEqual(evaluateQuery("$..*", value), [
      {
        book: [
          {
            author: "Nigel Rees",
            category: "reference",
            price: 8.95,
            title: "Sayings of the Century",
          },
          {
            author: "Evelyn Waugh",
            category: "fiction",
            price: 12.99,
            title: "Sword of Honour",
          },
          {
            author: "Herman Melville",
            category: "fiction",
            isbn: "0-553-21311-3",
            price: 8.99,
            title: "Moby Dick",
          },
          {
            author: "J. R. R. Tolkien",
            category: "fiction",
            isbn: "0-395-19395-8",
            price: 22.99,
            title: "The Lord of the Rings",
          },
        ],
        bicycle: {
          color: "red",
          price: 399,
        },
      },
      [
        {
          author: "Nigel Rees",
          category: "reference",
          price: 8.95,
          title: "Sayings of the Century",
        },
        {
          author: "Evelyn Waugh",
          category: "fiction",
          price: 12.99,
          title: "Sword of Honour",
        },
        {
          author: "Herman Melville",
          category: "fiction",
          isbn: "0-553-21311-3",
          price: 8.99,
          title: "Moby Dick",
        },
        {
          author: "J. R. R. Tolkien",
          category: "fiction",
          isbn: "0-395-19395-8",
          price: 22.99,
          title: "The Lord of the Rings",
        },
      ],
      {
        color: "red",
        price: 399,
      },
      {
        author: "Nigel Rees",
        category: "reference",
        price: 8.95,
        title: "Sayings of the Century",
      },
      {
        author: "Evelyn Waugh",
        category: "fiction",
        price: 12.99,
        title: "Sword of Honour",
      },
      {
        author: "Herman Melville",
        category: "fiction",
        isbn: "0-553-21311-3",
        price: 8.99,
        title: "Moby Dick",
      },
      {
        author: "J. R. R. Tolkien",
        category: "fiction",
        isbn: "0-395-19395-8",
        price: 22.99,
        title: "The Lord of the Rings",
      },
      "reference",
      "Nigel Rees",
      "Sayings of the Century",
      8.95,
      "fiction",
      "Evelyn Waugh",
      "Sword of Honour",
      12.99,
      "fiction",
      "Herman Melville",
      "Moby Dick",
      "0-553-21311-3",
      8.99,
      "fiction",
      "J. R. R. Tolkien",
      "The Lord of the Rings",
      "0-395-19395-8",
      22.99,
      "red",
      399,
    ]);
  });

  void test("should transcode query expressions", () => {
    assert.equal(
      formatQuery(parseQuery("$.store.book[*].author")),
      "$.store.book.*.author",
    );
    assert.equal(formatQuery(parseQuery("$..author")), "$..author");
    assert.equal(formatQuery(parseQuery("$.store.*")), "$.store.*");
    assert.equal(formatQuery(parseQuery("$.store..price")), "$.store..price");
    assert.equal(formatQuery(parseQuery("$..book[2]")), "$..book[2]");
    assert.equal(
      formatQuery(parseQuery("$..book[2].author")),
      "$..book[2].author",
    );
    assert.equal(
      formatQuery(parseQuery("$..book[2].publisher")),
      "$..book[2].publisher",
    );
    assert.equal(formatQuery(parseQuery("$..book[-1]")), "$..book[-1]");
    assert.equal(formatQuery(parseQuery("$..book[0,1]")), "$..book[0, 1]");
    assert.equal(formatQuery(parseQuery("$..book[:2]")), "$..book[:2]");
    assert.equal(
      formatQuery(parseQuery("$..book[?@.isbn]")),
      "$..book[?@.isbn]",
    );
    assert.equal(
      formatQuery(parseQuery("$..book[?@.price<10]")),
      "$..book[?@.price < 10]",
    );
    assert.equal(formatQuery(parseQuery("$..*")), "$..*");
  });

  void test("should evaluate null expressions", () => {
    const value = { a: null, b: [null], c: [{}], null: 1 } as const;
    assert.deepEqual(evaluateQuery("$.a", value), [null]);
    assert.deepEqual(evaluateQuery("$.a[0]", value), []);
    assert.deepEqual(evaluateQuery("$.a.d", value), []);
    assert.deepEqual(evaluateQuery("$.b[0]", value), [null]);
    assert.deepEqual(evaluateQuery("$.b[*]", value), [null]);
    assert.deepEqual(evaluateQuery("$.b[?@]", value), [null]);
    assert.deepEqual(evaluateQuery("$.b[?@==null]", value), [null]);
    assert.deepEqual(evaluateQuery("$.c[?@.d==null]", value), []);
    assert.deepEqual(evaluateQuery("$.null", value), [1]);
  });

  void test("should transcode null expressions", () => {
    assert.equal(formatQuery(parseQuery("$.a")), "$.a");
    assert.equal(formatQuery(parseQuery("$.a[0]")), "$.a[0]");
    assert.equal(formatQuery(parseQuery("$.a.d")), "$.a.d");
    assert.equal(formatQuery(parseQuery("$.b[0]")), "$.b[0]");
    assert.equal(formatQuery(parseQuery("$.b[*]")), "$.b.*");
    assert.equal(formatQuery(parseQuery("$.b[?@]")), "$.b[?@]");
    assert.equal(formatQuery(parseQuery("$.b[?@==null]")), "$.b[?@ == null]");
    assert.equal(
      formatQuery(parseQuery("$.c[?@.d==null]")),
      "$.c[?@.d == null]",
    );
    assert.equal(formatQuery(parseQuery("$.null")), "$.null");
  });
});
