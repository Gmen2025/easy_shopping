const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const babel = require("@babel/core");

test("Admin Products uses one bounded list with scrollable controls and loading state", () => {
  const filename = path.join(__dirname, "..", "Screens", "Admin", "Products.js");
  const result = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, ast: true,
    parserOpts: { plugins: ["jsx"] },
  });
  const elements = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXElement") elements.push(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(result.ast);
  const named = (node, name) => node.openingElement.name.name === name;
  const lists = elements.filter((node) => named(node, "FlatList"));
  assert.equal(lists.length, 1);
  assert.equal(elements.some((node) => named(node, "ScrollView")), false);
  const attributes = lists[0].openingElement.attributes;
  const attribute = (name) => attributes.find((entry) => entry.name?.name === name);
  assert.equal(attribute("style").value.expression.property.name, "productList");
  assert.equal(attribute("keyboardShouldPersistTaps").value.value, "handled");
  assert.ok(attribute("showsVerticalScrollIndicator"));
  const header = attribute("ListHeaderComponent").value.expression;
  const headerElements = [];
  function collect(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXElement") headerElements.push(node);
    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") collect(value);
    });
  }
  collect(header);
  assert.equal(headerElements.filter((node) => named(node, "ActionButton")).length, 13);
  assert.ok(headerElements.some((node) => named(node, "Searchbar")));
  assert.ok(headerElements.some((node) => named(node, "ListHeader")));
  assert.equal(attribute("ListEmptyComponent").value.expression.test.name, "loading");
  assert.equal(attribute("data").value.expression.test.name, "loading");
});
