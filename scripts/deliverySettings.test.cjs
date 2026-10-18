const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
function harness({ failure } = {}) {
  const states = [], effects = [], messages = [], writes = [];
  let cursor = 0, database = "E_ShopUSA";
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
    },
    useEffect: (effect) => effects.push(effect),
  };
  const settings = { sameDayBase: 9, sameDayPerKm: 1, sameDayPremium: 4, nextDayBase: 4, nextDayPerKm: 0.6,
    scheduledBase: 5, scheduledPerKm: 0.75, scheduledPeakSurcharge: 1.5, scheduledOffPeakDiscount: 0.5,
    expressMinBusinessDays: 1, expressMaxBusinessDays: 2, standardMinBusinessDays: 2, standardMaxBusinessDays: 5,
    expressSurcharge: 0, standardSurcharge: 0, scheduledSurcharge: 0, scheduledWindowHours: 2, retainedSetting: 42 };
  const dependencies = {
    react, "react-native": { ActivityIndicator: "ActivityIndicator", ScrollView: "ScrollView", Text: "Text",
      View: "View", StyleSheet: { create: (value) => value } },
    axios: { put: async (url, data) => { writes.push({ url, data }); return { data }; } },
    "@react-native-async-storage/async-storage": { getItem: async () => "test-token" },
    "react-native-toast-message": { show: (message) => messages.push(message) },
    "react-native-vector-icons/FontAwesome": "Icon", "../../assets/common/baseUrl": "https://api.example.test/",
    "../../Shared/Form/Input": "Input", "../../Shared/Form/FormContainer": "FormContainer",
    "../../Shared/StyledComponenets/EasyButton": "EasyButton",
    "../../assets/common/currency": { getCurrencyConfigForDatabase: () => ({ code: "USD" }) },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => database },
    "../../assets/common/delivery": {
      getDeliverySettings: async () => {
        if (failure) throw new Error(failure);
        return { deliveryConfig: settings };
      },
      cacheDeliverySettings: async () => {}, getDeliveryDistanceUnit: () => "mile",
    },
  };
  const filename = path.join(__dirname, "..", "Screens", "Admin", "DeliverySettings.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), { filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"] });
  const exports = {};
  vm.runInNewContext(code, { exports, console, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  const render = () => { cursor = 0; return exports.default(); };
  const input = (name) => nodes(render()).find((node) => node.type === "Input" && node.props.name === name);
  const save = () => nodes(render()).find((node) => node.type === "EasyButton").props.onPress();
  return { render, input, save, writes, messages, region: (value) => { database = value; }, start: async () => {
    render(); effects.forEach((effect) => effect());
    for (let at = 0; at < 5; at++) await new Promise(setImmediate);
  } };
}
test("Admin saves delivery windows and vehicle speed surcharges without losing scheduled or legacy configuration", async () => {
  const ui = harness();
  await ui.start();
  assert.equal(ui.input("expressMinBusinessDays").props.value, "1");
  ui.input("expressMaxBusinessDays").props.onChangeText("3");
  ui.input("expressSurcharge").props.onChangeText("2.50");
  ui.input("businessTimeZone").props.onChangeText("America/Chicago");
  ui.input("businessDayStartHour").props.onChangeText("8");
  ui.input("businessDayEndHour").props.onChangeText("24");
  await ui.save();
  assert.equal(ui.writes[0].data.deliveryConfig.expressMaxBusinessDays, 3);
  assert.equal(ui.writes[0].data.deliveryConfig.expressSurcharge, 2.5);
  assert.equal(ui.writes[0].data.deliveryConfig.standardMaxBusinessDays, 5);
  assert.equal(ui.writes[0].data.deliveryConfig.retainedSetting, 42);
  assert.equal(ui.writes[0].data.deliveryConfig.scheduledWindowHours, 2);
  assert.equal(ui.writes[0].data.deliveryConfig.businessTimeZone, "America/Chicago");
  assert.equal(ui.writes[0].data.deliveryConfig.businessDayStartHour, 8);
  assert.equal(ui.writes[0].data.deliveryConfig.businessDayEndHour, 24);
  assert.equal(ui.messages.at(-1).type, "success");
});
test("Admin rejects invalid day ranges, fractional days, empty fees and cross-region writes", async () => {
  for (const [field, value] of [["expressMinBusinessDays", "3"], ["standardMaxBusinessDays", "1"],
    ["expressMaxBusinessDays", "2.5"], ["expressSurcharge", ""], ["standardMinBusinessDays", "31"],
    ["businessDayEndHour", "9"], ["businessDayEndHour", "25"], ["businessDayEndHour", "0"], ["businessDayStartHour", "9.5"]]) {
    const ui = harness();
    await ui.start();
    ui.input(field).props.onChangeText(value);
    await ui.save();
    assert.equal(ui.writes.length, 0);
    assert.equal(ui.messages.at(-1).type, "error");
  }
  const ui = harness();
  await ui.start();
  ui.region("E_Shopping");
  await ui.save();
  assert.equal(ui.writes.length, 0);
  assert.equal(ui.messages.at(-1).type, "error");
});
test("failed Admin settings load does not expose editable success-shaped default prices", async () => {
  const ui = harness({ failure: "Offline" });
  await ui.start();
  assert.equal(ui.input("expressMinBusinessDays").props.value, "");
  await ui.save();
  assert.equal(ui.writes.length, 0);
  assert.equal(ui.messages.at(-1).type, "error");
});
