# Tool Query

[![Package](https://img.shields.io/badge/npm-0.1.0-ae8c7e?labelColor=3b3a37)](https://www.npmjs.com/package/tool-query)
[![License](https://img.shields.io/badge/license-MIT-ae8c7e?labelColor=3b3a37)](https://opensource.org/licenses/MIT)

JSONPath (RFC 9535) implementation.

## Installation

To install the package, run:

```bash
npm install tool-query
```

## Usage

### Basic Queries

```typescript
import { evaluateQuery } from "tool-query";

const data = {
  store: {
    book: [
      {
        category: "fiction",
        author: "Jean M. Auel",
        title: "Clan of the Cave Bear",
        price: 14.95
      },
      {
        category: "anthropology",
        author: "Yuval Noah Harari",
        title: "Sapiens",
        price: 24.99
      }
    ]
  }
};

// Select all authors
for (const node of evaluateQuery("$.store.book[*].author", data)) {
  console.log(node); // "Jean M. Auel", "Yuval Noah Harari"
}

// Select all books with price < 20
for (const node of evaluateQuery("$.store.book[?@.price < 20]", data)) {
  console.log(node); // { category: "fiction", ... }
}

// Select all prices using recursive descent
for (const node of evaluateQuery("$..price", data)) {
  console.log(node); // 14.95, 24.99
}
```

### Query Components

#### Root Identifier

Every JSONPath query starts with a root identifier (`$`), which represents the root node:

```typescript
// Select the root node
evaluateQuery("$", data);

// Select immediate children of root
evaluateQuery("$.*", data);

// Select all descendants of root
evaluateQuery("$..*", data);
```

#### Segments

Segments select children or descendants of nodes:

```typescript
// Child segment with name selector
evaluateQuery("$.store.book", data);

// Child segment with index selector
evaluateQuery("$.store.book[0]", data);

// Child segment with multiple selectors
evaluateQuery("$.store.book[0, 1]", data);

// Descendant segment
evaluateQuery("$..book", data);
```

#### Selectors

Selectors filter nodes within segments:

```typescript
// Name selector
evaluateQuery("$.store.book", data);
evaluateQuery("$.store['book']", data);

// Wildcard selector
evaluateQuery("$.store.*", data);

// Index selector
evaluateQuery("$.store.book[0]", data);
evaluateQuery("$.store.book[-1]", data); // Last element

// Slice selector
evaluateQuery("$.store.book[0:2]", data);
evaluateQuery("$.store.book[::2]", data); // Every second element

// Filter selector
evaluateQuery("$.store.book[?@.price < 20]", data);
```

#### Filter Expressions

Filter selectors support complex expressions:

```typescript
// Comparison operators
evaluateQuery("$.store.book[?@.price < 20]", data);
evaluateQuery("$.store.book[?@.category == 'fiction']", data);

// Logical operators
evaluateQuery("$.store.book[?@.price < 20 && @.category == 'fiction']", data);
evaluateQuery("$.store.book[?@.price < 20 || @.category == 'fiction']", data);
evaluateQuery("$.store.book[?!@.price]", data);

// Nested queries
evaluateQuery("$.store.book[?@.author == $.store.book[0].author]", data);

// Built-in functions
evaluateQuery("$.store.book[?length(@.author) > 10]", data);
evaluateQuery("$.store.book[?count(@.authors) >= 2]", data);
```

### Built-in Functions

The library provides several built-in functions for use in filter expressions:

#### length()

Computes the length of a value:

- For strings: number of Unicode scalar values
- For arrays: number of elements
- For objects: number of members
- For other values: Nothing (undefined)

```typescript
evaluateQuery("$[?length(@.authors) >= 2]", data);
```

#### count()

Counts the number of nodes in a nodelist:

```typescript
evaluateQuery("$[?count(@.*.author) >= 5]", data);
```

#### match()

Tests if a string matches a regular expression pattern:

```typescript
evaluateQuery("$[?match(@.date, '1974-05-..')]", data);
```

#### search()

Tests if a string contains a substring matching a regular expression pattern:

```typescript
evaluateQuery("$[?search(@.author, '[BR]ob')]", data);
```

#### value()

Converts a nodelist to a value:

- For single-node nodelists: the node's value
- For empty or multi-node nodelists: Nothing (undefined)

```typescript
evaluateQuery("$[?value(@..color) == 'red']", data);
```

### Function Extensions

You can extend the query language with custom functions:

```typescript
import type { FunctionExtension } from "tool-query";
import { DeclaredType } from "tool-query";

// Define a custom function extension.
const isEvent = {
  name: "isEven",
  parameterTypes: [DeclaredType.Value],
  resultType: DeclaredType.Logical,
  evaluate([value], context) {
    return typeof value === "number" && value % 2 === 0;
  }
} as const satisfies FunctionExtension;

// Call the function in filter expressions.
evaluateQuery("$[?isEven(@.count)]", data, {
  functions: { isEven }
});
```

### Query Parsing and Formatting

The library provides utilities for working with query strings:

```typescript
import { parseQuery, formatQuery, tryParseQuery } from "tool-query";

// Parse a query string
const query = parseQuery("$.store.book[*].author");

// Format a query back to string
const queryString = formatQuery(query);

// Try parsing with fallback
const maybeQuery = tryParseQuery("$.invalid["); // undefined
```

### Error Handling

The library throws `QueryError` for invalid queries:

```typescript
import { QueryError } from "tool-query";

try {
  evaluateQuery("$.invalid[", data);
} catch (error) {
  if (error instanceof QueryError) {
    console.log(error.message);
    console.log(error.input); // Original input
    console.log(error.offset); // Error position
  }
}
```

## License

MIT © Tool Cognition Inc.
