"use strict";

const { Locales } = require("../Constants");

function translate(client, key, locales, values = {}) {
  const catalogs = client.options.translations || {};
  for (const locale of locales) {
    if (!locale) {
      continue;
    }
    const parts = locale.toLowerCase().split("-");
    while (parts.length) {
      const tag = parts.join("-");
      const catalog = Object.keys(catalogs).find((name) => name.toLowerCase() === tag);
      if (catalog && Object.prototype.hasOwnProperty.call(catalogs[catalog], key)) {
        return catalogs[catalog][key].replace(/\{(\w+)\}/g, (match, name) =>
          Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
      }
      parts.pop();
    }
  }
  return key.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match);
}

function localizeDefinition(client, definition) {
  const result = Object.assign({}, definition);
  for (const field of ["name", "description"]) {
    if (typeof definition[field] !== "string") {
      continue;
    }
    const mapping = {};
    for (const locale of Object.values(Locales)) {
      const translated = translate(client, definition[field], [locale]);
      if (translated !== definition[field]) {
        mapping[locale] = translated;
      }
    }
    const wireField = field + "_localizations";
    const existing = definition[field + "Localizations"];
    if (definition[wireField] === null || existing === null) {
      result[wireField] = null;
      delete result[field + "Localizations"];
      continue;
    }
    if (Object.keys(mapping).length || existing || definition[wireField]) {
      result[wireField] = Object.assign(mapping, existing, definition[wireField]);
      delete result[field + "Localizations"];
    }
  }
  for (const field of ["options", "choices"]) {
    if (Array.isArray(definition[field])) {
      result[field] = definition[field].map((entry) => localizeDefinition(client, entry));
    }
  }
  return result;
}

async function run(client, source, handler, middlewares, args, command) {
  const guild = source.channel && source.channel.guild;
  const context = {
    client,
    source,
    args,
    command,
    metadata: Object.create(null),
    locale: source.locale || source.guildLocale || (guild && guild.preferredLocale) || client.options.defaultLocale || "en",
    t(key, values) {
      return translate(client, key, [context.locale, source.guildLocale, guild && guild.preferredLocale, client.options.defaultLocale || "en"], values);
    },
  };
  for (const middleware of new Set([...(client.options.commandMiddlewares || []), ...middlewares])) {
    if (await middleware(context) === false) {
      return;
    }
  }
  return handler(context);
}

module.exports = { localizeDefinition, run };
