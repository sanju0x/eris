"use strict";

const { Locales } = require("../Constants");
const commands = require("../locales/commands.json");
const music = require("../locales/music.json");

// Only Discord display fields participate in translation. IDs, values, URLs,
// files and other transport fields pass through unchanged.
const componentText = {
  label: true,
  placeholder: true,
  description: true,
  content: true,
  title: true,
  options: { label: true, description: true },
};
componentText.components = componentText;
componentText.accessory = componentText;
componentText.component = componentText;
const embedText = {
  title: true,
  description: true,
  author: { name: true },
  footer: { text: true },
  fields: { name: true, value: true },
};
const messageText = {
  content: true,
  embeds: embedText,
  embed: embedText,
  components: componentText,
  attachments: { description: true },
  poll: { question: { text: true }, answers: { poll_media: { text: true } } },
};

function translateFields(value, fields, translate) {
  if (Array.isArray(value)) {
    return value.map((entry) => translateFields(entry, fields, translate));
  }
  if (fields === true) {
    return typeof value === "string" ? translate(value) : value;
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const result = Object.assign({}, value);
  for (const field of Object.keys(fields)) {
    if (Object.prototype.hasOwnProperty.call(value, field)) {
      result[field] = translateFields(value[field], fields[field], translate);
    }
  }
  return result;
}

function addMessages(catalog, messages, prefix = "") {
  if (!messages || ![Object.prototype, null].includes(Object.getPrototypeOf(messages))) {
    throw new TypeError("Expected a translation object at " + (prefix || "<root>"));
  }
  for (const [name, value] of Object.entries(messages)) {
    const key = prefix ? prefix + "." + name : name;
    if (typeof value === "string" || typeof value === "function") {
      catalog.set(key, value);
    } else {
      addMessages(catalog, value, key);
    }
  }
}

function route(i18n, locales, path = "", args = []) {
  return new Proxy(() => {}, {
    get(target, name) {
      if (name === "get") {
        return (locale) => {
          const candidates = locale === undefined ? locales : locale;
          if (!path) {
            return i18n.tree(candidates);
          }
          return i18n.render(path, candidates, args);
        };
      }
      if (typeof name === "string" && name !== "then") {
        return route(i18n, locales, path ? path + "." + name : name);
      }
    },
    apply(target, receiver, values) {
      return route(i18n, locales, path, values);
    },
  });
}

class I18n {
  constructor(defaultLocale = "en") {
    this.defaultLocale = defaultLocale;
    this.catalogs = new Map();
    for (const [locale, messages] of Object.entries(music)) {
      this.register(locale, Object.assign({}, commands[locale], messages));
    }
  }

  register(locale, messages) {
    const tag = locale.toLowerCase();
    const catalog = new Map(this.catalogs.get(tag));
    addMessages(catalog, messages);
    this.catalogs.set(tag, catalog);
  }

  tMessage(message, locales, values) {
    return translateFields(message, typeof message === "string" ? true : messageText, (key) => this.t(key, locales, values));
  }

  load(directory) {
    const fs = require("fs");
    const path = require("path");
    const loaded = new Map(this.catalogs);
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.resolve(directory, name);
      if (!/\.(?:json|c?js)$/.test(name) || !fs.statSync(filename).isFile()) {
        continue;
      }
      const tag = path.parse(name).name.toLowerCase();
      const data = path.extname(filename) === ".json" ? JSON.parse(fs.readFileSync(filename, "utf8")) : require(filename);
      const catalog = new Map(loaded.get(tag));
      addMessages(catalog, data.__esModule ? data.default : data);
      loaded.set(tag, catalog);
    }
    this.catalogs = loaded;
  }

  get(locales) {
    return route(this, locales);
  }

  candidates(locales, fallback = true) {
    const tags = new Set();
    for (const locale of [].concat(locales || [], fallback ? [this.defaultLocale, "en"] : [])) {
      if (locale) {
        const parts = locale.toLowerCase().split("-");
        while (parts.length) {
          tags.add(parts.join("-"));
          parts.pop();
        }
      }
    }
    return Array.from(tags, (tag) => this.catalogs.get(tag)).filter(Boolean);
  }

  tree(locales) {
    const root = Object.create(null);
    for (const catalog of this.candidates(locales).reverse()) {
      for (const [key, value] of catalog) {
        const parts = key.split(".");
        const leaf = parts.pop();
        let node = root;
        for (const part of parts) {
          if (!node[part] || typeof node[part] !== "object") {
            node[part] = Object.create(null);
          }
          node = node[part];
        }
        node[leaf] = value;
      }
    }
    return root;
  }

  commandLocalizations(keys) {
    const result = {};
    for (const field of ["name", "description"]) {
      if (!keys[field]) {
        continue;
      }
      const translations = {};
      for (const locale of Object.values(Locales)) {
        const catalog = this.candidates(locale, false).find((entry) => entry.has(keys[field]));
        const value = catalog && catalog.get(keys[field]);
        if (typeof value === "string") {
          translations[locale] = value;
        }
      }
      result[field + "_localizations"] = translations;
    }
    return result;
  }

  render(key, locales, args) {
    const catalog = this.candidates(locales).find((entry) => entry.has(key));
    if (!catalog) {
      return key;
    }
    const message = catalog.get(key);
    if (typeof message === "function") {
      return message(...args);
    }
    const values = args[0] || {};
    return message.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
  }

  t(key, locales, values) {
    return this.render(key, locales, values === undefined ? [] : [values]);
  }
}

module.exports = I18n;
