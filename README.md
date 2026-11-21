Eris [![NPM version](https://img.shields.io/npm/v/eris.svg?style=flat-square&color=informational)](https://npmjs.com/package/eris)
====

A Node.js wrapper for interfacing with Discord.

Installing
----------

You will need NodeJS 10.4+. If you need voice support you will also need Python 2.7 and a C++ compiler. Refer to [the Getting Started section of the docs](https://abal.moe/Eris/docs) for more details.

```
npm install --no-optional eris
```

If you need voice support, remove the `--no-optional`.

Ping Pong Example
-----------------

```js
const Eris = require("eris");

// Replace TOKEN with your bot account's token
const bot = new Eris("Bot TOKEN", {
    intents: [
        "guildMessages"
    ]
});

bot.on("ready", () => { // When the bot is ready
    console.log("Ready!"); // Log "Ready!"
});

bot.on("error", (err) => {
  console.error(err); // or your preferred logger
});

bot.on("messageCreate", (msg) => { // When a message is created
    if(msg.content === "!ping") { // If the message content is "!ping"
        bot.createMessage(msg.channel.id, "Pong!");
        // Send a message in the same channel with "Pong!"
    } else if(msg.content === "!pong") { // Otherwise, if the message is "!pong"
        bot.createMessage(msg.channel.id, "Ping!");
        // Respond with "Ping!"
    }
});

bot.connect(); // Get the bot to connect to Discord
```

More examples can be found in [the examples folder](https://github.com/abalabahaha/eris/tree/master/examples).

Translated bot replies
----------------------

Eris bundles music messages, player controls, and command help in English,
Malayalam, Hindi, Tamil, Korean, Japanese, Simplified and Traditional Chinese,
Indonesian, Brazilian Portuguese, Spanish, and French. See the complete
[music catalog](lib/locales/music.json) and [command catalog](lib/locales/commands.json).

Build a reply from catalog keys and translate it each time you send or edit it:

```js
// In your interactionCreate handler, with the current track title:
const player = {
  content: "music.nowPlaying",
  components: [{
    type: 1,
    components: [{ type: 2, style: 2, custom_id: "pause", label: "music.pause" }],
  }],
};
await interaction.createMessage(interaction.tMessage(player, { title }));

// If your bot has a saved language setting, pass that language explicitly.
// Use the original template to refresh an existing player after a language change.
await interaction.editOriginalMessage(bot.i18n.tMessage(player, savedLocale, { title }));
```

`tMessage` translates registered keys in message content, embed text and fields,
component labels, select options, placeholders, attachment descriptions, and
poll text. IDs, URLs, and option values pass through. Use placeholders for song
titles, usernames, and other dynamic values. To cover your bot's own wording,
register each phrase in each supported language:

```js
bot.i18n.register("en", { "trial.claim": "Claim free trial" });
bot.i18n.register("ml", { "trial.claim": "സൗജന്യ ട്രയൽ നേടുക" });
```

For single strings use `interaction.t(key, values)`. Interactions try the user's
Discord locale, the guild locale, the client's default locale, then English.
Prefix command help uses `msg.t(key, values)`, which starts with the guild
locale. Set `bot.i18n.defaultLocale` to change the fallback at runtime. Regional
tags try their parent language. Unregistered strings pass through verbatim.

### Seyfert-style language files

Set `localeDirectory` to a directory of locale-named JSON or CommonJS files
such as `ml.json` and `en.js`. Each file can contain nested groups. CommonJS
files can also export formatter functions. Eris loads these files at startup.
You can also pass an imported catalog directly to `bot.i18n.register`.

```js
// languages/en.js
module.exports = {
  player: {
    count: (n) => n === 1 ? "1 song" : `${n} songs`,
    queueName: "queue",
    queueDescription: "Show the playback queue",
  },
};
```

```js
const bot = new Eris.Client(token, { localeDirectory: "./languages" });
bot.on("interactionCreate", async (interaction) => {
  if (interaction instanceof Eris.CommandInteraction && interaction.data.name === "queue") {
    const t = interaction.translations;
    await interaction.createMessage(t.player.count(queue.length).get());
  }
});
```

Use `bot.t("ml").music.pause.get()` for an explicit locale, or
`interaction.translations.music.pause.get(savedLocale)` for a saved preference.
Set `preferGuildLocale: true` to prioritize Discord's guild language for
interaction replies. For TypeScript autocomplete, augment Eris with your
application's namespaces:

```ts
import type en = require("./languages/en");
declare module "eris" {
  interface TranslationSchema {
    player: typeof en.player;
  }
}
```

To publish translated slash-command names and descriptions, spread
`bot.i18n.commandLocalizations({ name: "player.queueName", description: "player.queueDescription" })`
into your command or option definition before registering it. The helper emits
Discord-supported locales that have a matching string. Supply the ordinary
default name and description alongside them.

Useful Links
------------

- [The website](https://abal.moe/Eris/) has more details and documentation.
- [The official Eris server](https://abal.moe/Eris/invite) is the best place to get support.
- [The GitHub repo](https://github.com/abalabahaha/eris) is where development primarily happens.
- [The NPM package webpage](https://npmjs.com/package/eris) is, well, the webpage for the NPM package.

License
-------

Refer to the [LICENSE](LICENSE) file.
