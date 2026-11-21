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

Command middleware and localization
-----------------------------------

Configure shared middleware and application-owned translations on a client.
Middleware runs in registration order, followed by command-specific middleware.
It can prepare invocation metadata, set a saved locale, or return `false` to
stop execution. Each invocation gets its own metadata object.

```js
const bot = new Eris.CommandClient(token, {
  defaultLocale: "en",
  translations: {
    ml: { ping: "പിംഗ്", "Check latency": "പ്രതികരണ സമയം പരിശോധിക്കുക", "Pong!": "പോങ്!" },
    fr: { ping: "latence", "Check latency": "Vérifier la latence", "Pong!": "Pong !" },
  },
  commandMiddlewares: [
    async (ctx) => {
      ctx.metadata.started = Date.now();
      // Set ctx.locale here to a saved user or server language if needed.
    },
  ],
});

bot.registerCommand("ping", (msg, args, ctx) => ctx.t("Pong!"), {
  description: "Check latency",
  middlewares: [(ctx) => { if (!ctx.source.author) return false; }],
});

bot.on("interactionCreate", async (interaction) => {
  if (interaction instanceof Eris.CommandInteraction && interaction.data.name === "ping") {
    await bot.runCommand(interaction, (ctx) =>
      interaction.createMessage(ctx.t("Pong!")));
  }
});

// In your command-registration routine after the client is ready:
await bot.createCommand(bot.localizeCommand({
  name: "ping",
  description: "Check latency",
}));
```

`localizeCommand` builds Discord localization maps for names, descriptions,
nested options and choices. Use valid default command names and descriptions
as translation keys. Only Discord-supported locales are included in the maps.
Responses can use additional languages and interpolate values such as
`ctx.t("Hello {name}", { name: "Delta" })`. Unknown phrases fall back to their
original text. Prefix commands use the guild locale, and application commands
use the invoking user's locale when available.

Useful Links
------------

- [The website](https://abal.moe/Eris/) has more details and documentation.
- [The official Eris server](https://abal.moe/Eris/invite) is the best place to get support.
- [The GitHub repo](https://github.com/abalabahaha/eris) is where development primarily happens.
- [The NPM package webpage](https://npmjs.com/package/eris) is, well, the webpage for the NPM package.

License
-------

Refer to the [LICENSE](LICENSE) file.
