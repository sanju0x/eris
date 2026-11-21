"use strict";

const assert = require("assert");
const Eris = require("..");
const catalogs = require("../lib/locales/music.json");

const client = new Eris.Client("test", { defaultLocale: "ml" });
const interaction = Eris.Interaction.from({
  id: "1",
  type: 1,
  locale: "fr-CA",
  guild_locale: "hi",
}, client);

for (const [locale, messages] of Object.entries(catalogs)) {
  assert.deepStrictEqual(Object.keys(messages).sort(), Object.keys(catalogs.en).sort());
  assert.strictEqual(client.i18n.t("music.nowPlaying", locale, { title: "$&" }), messages["music.nowPlaying"].replace("{title}", () => "$&"));
}
assert.strictEqual(interaction.t("music.paused"), catalogs.fr["music.paused"]);
client.i18n.register("hi", { welcome: "नमस्ते {name}" });
assert.strictEqual(interaction.t("welcome", { name: "Delta" }), "नमस्ते Delta");
client.i18n.register("ml", { fallback: "മലയാളം" });
assert.strictEqual(interaction.t("fallback"), "മലയാളം");
client.i18n.register("en", { fallbackEn: "Hello {name}", blank: "" });
assert.strictEqual(interaction.t("fallbackEn"), "Hello {name}");
assert.strictEqual(interaction.t("blank"), "");
assert.strictEqual(interaction.t("unknown"), "unknown");
assert.strictEqual(new Eris.Client("test").i18n.t("welcome", "hi"), "welcome");

const commands = require("../lib/locales/commands.json");
for (const catalog of [commands, catalogs]) {
  for (const messages of Object.values(catalog)) {
    assert.deepStrictEqual(Object.keys(messages).sort(), Object.keys(catalog.en).sort());
    for (const [key, value] of Object.entries(messages)) {
      assert(value.length > 0);
      assert.deepStrictEqual((value.match(/\{\w+\}/g) || []).sort(), (catalog.en[key].match(/\{\w+\}/g) || []).sort());
    }
  }
}

const template = {
  content: "music.added",
  embeds: [{ title: "music.queue", fields: [{ name: "music.requester", value: "Delta" }], url: "music.queue" }],
  components: [{ type: 1, components: [{ type: 3, custom_id: "music.queue", placeholder: "music.queue", options: [{ label: "music.pause", value: "music.pause" }] }] }],
  poll: { question: { text: "music.next" }, answers: [{ poll_media: { text: "music.skip" } }] },
};
for (const locale of ["ml", "ja"]) {
  interaction.locale = locale;
  const reply = interaction.tMessage(template, { title: "$& {title}" });
  assert.strictEqual(reply.content, catalogs[locale]["music.added"].replace("{title}", () => "$& {title}"));
  assert.strictEqual(reply.embeds[0].title, catalogs[locale]["music.queue"]);
  assert.strictEqual(reply.embeds[0].url, "music.queue");
  assert.deepStrictEqual(reply.embeds[0].fields[0], { name: catalogs[locale]["music.requester"], value: "Delta" });
  const menu = reply.components[0].components[0];
  assert.strictEqual(menu.custom_id, "music.queue");
  assert.strictEqual(menu.placeholder, catalogs[locale]["music.queue"]);
  assert.deepStrictEqual(menu.options[0], { label: catalogs[locale]["music.pause"], value: "music.pause" });
  assert.strictEqual(reply.poll.answers[0].poll_media.text, catalogs[locale]["music.skip"]);
}
assert.strictEqual(template.embeds[0].title, "music.queue");

async function checkHelp() {
  const bot = new Eris.CommandClient("test", { defaultLocale: "ml" }, { name: "Delta" });
  const msg = Object.assign(Object.create(Eris.Message.prototype), { _client: bot, channel: {}, prefix: "!" });
  const help = bot.commands.help;
  assert.strictEqual(await help.executeCommand(msg, ["missing"]), commands.ml["Command not found"]);
  msg.channel.guild = { preferredLocale: "fr-CA" };
  assert.strictEqual(await help.executeCommand(msg, ["missing"]), commands.fr["Command not found"]);
  help.permissionCheck = () => true;
  const text = await help.executeCommand(msg, []);
  assert(text.includes(commands.fr["Commands:"]));
  assert(text.includes("!help <commande>"));
  assert(text.includes(commands.fr["This help text"]));
  assert((await help.executeCommand(msg, ["help"])).includes(commands.fr[help.fullDescription]));
  assert(bot.commandOptions.defaultCommandOptions.invalidUsageMessage(msg).includes("%prefix%help %label%"));
}
checkHelp().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

const fs = require("fs");
const path = require("path");
const os = require("os");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "eris-locales-"));
try {
  fs.writeFileSync(path.join(directory, "en.js"), 'module.exports = { player: { count: (n) => n + " songs", label: "Queue", name: "queue" } };');
  fs.writeFileSync(path.join(directory, "fr.json"), JSON.stringify({ player: { label: "File", name: "file" } }));
  const bot = new Eris.Client("test", { localeDirectory: directory, preferGuildLocale: true });
  const ping = Eris.Interaction.from({ id: "1", type: 1, locale: "en-US", guild_locale: "fr-CA" }, bot);
  assert.strictEqual(ping.translations.player.label.get(), "File");
  assert.strictEqual(ping.translations.player.label.get("en"), "Queue");
  assert.strictEqual(ping.translations.player.count(2).get(), "2 songs");
  assert.strictEqual(ping.translations.get().player.label, "File");
  assert.strictEqual(bot.t("fr").get().player.count(3), "3 songs");
  assert.strictEqual(bot.t("ml").music.nowPlaying({ title: "Delta" }).get(), catalogs.ml["music.nowPlaying"].replace("{title}", "Delta"));
  assert.strictEqual(ping.tMessage({ content: "player.label" }).content, "File");
  const names = bot.i18n.commandLocalizations({ name: "player.name" }).name_localizations;
  assert.deepStrictEqual(names, { "en-GB": "queue", "en-US": "queue", fr: "file" });
  fs.writeFileSync(path.join(directory, "fr.json"), JSON.stringify({ player: { label: "Updated" } }));
  fs.writeFileSync(path.join(directory, "ja.json"), "{");
  assert.throws(() => bot.i18n.load(directory), SyntaxError);
  assert.strictEqual(ping.translations.player.label.get(), "File");
} finally {
  for (const file of fs.readdirSync(directory)) {
    fs.unlinkSync(path.join(directory, file));
  }
  fs.rmdirSync(directory);
}
