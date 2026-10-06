const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function fixture({ failure } = {}) {
  const filename = path.join(__dirname, "..", "Screens", "Admin", "AdminDrivers.js");
  const { ast } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, ast: true, code: false,
    parserOpts: { plugins: ["jsx"] },
  });
  const component = ast.program.body.find((node) => node.type === "VariableDeclaration" &&
    node.declarations.some((entry) => entry.id.name === "AdminDrivers"));
  ast.program.body = component.declarations[0].init.body.body.filter((node) =>
    node.type === "VariableDeclaration" && node.declarations.some((entry) =>
      ["reinstateDriver", "confirmReinstatement"].includes(entry.id.name)));
  const { code } = babel.transformFromAstSync(ast, null, { configFile: false, babelrc: false });
  const alerts = [];
  const requests = [];
  const states = [];
  let reloads = 0;
  const context = {
    reinstatingDriverId: "", setReinstatingDriverId: (value) => states.push(value),
    AsyncStorage: { getItem: async () => "session" },
    getDatabaseNameFromStorage: async () => "E_Shopping",
    baseUrl: "https://example.invalid/api/",
    loadDrivers: async () => { reloads += 1; },
    axios: { put: async (...args) => {
      requests.push(args);
      if (failure) throw { response: { data: { message: failure } } };
    } },
    Alert: { alert: (...args) => alerts.push(args) },
  };
  vm.runInNewContext(`${code}\nconfirm = confirmReinstatement;`, context);
  return { confirm: context.confirm, alerts, requests, states, reloads: () => reloads };
}

test("company-driver reinstatement requires confirmation and targets the selected database", async () => {
  const f = fixture();
  f.confirm({ _id: "driver", name: "Company driver", suspensionReason: "Admin suspension" });
  assert.equal(f.requests.length, 0);
  assert.match(f.alerts[0][1], /Admin suspension/);
  const buttons = f.alerts[0][2];
  assert.equal(buttons[0].style, "cancel");
  await buttons[1].onPress();
  assert.equal(f.requests[0][0], "https://example.invalid/api/drivers/driver/reinstate");
  assert.equal(f.requests[0][2].headers["x-database-name"], "E_Shopping");
  assert.equal(f.requests[0][2].headers.Authorization, "Bearer session");
  assert.equal(f.requests[0][2].timeout, 20000);
  assert.equal(f.reloads(), 1);
  assert.deepEqual(f.states, ["driver", ""]);
  assert.equal(f.alerts.at(-1)[0], "Driver reinstated");
});

test("failed reinstatement surfaces the server error and releases the loading state", async () => {
  const f = fixture({ failure: "Admin access required" });
  f.confirm({ _id: "driver", name: "Company driver" });
  await f.alerts[0][2][1].onPress();
  assert.equal(f.reloads(), 0);
  assert.equal(f.alerts.at(-1)[0], "Unable to reinstate driver");
  assert.equal(f.alerts.at(-1)[1], "Admin access required");
  assert.deepEqual(f.states, ["driver", ""]);
});
