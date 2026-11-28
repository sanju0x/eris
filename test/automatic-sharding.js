"use strict";

const assert = require("assert");
const Eris = require("..");
const Shard = require("../lib/gateway/Shard");

function makeGuilds(count, spacing = 1) {
  return Array.from({ length: count }, (_, i) => ({
    id: (BigInt((i + 1) * spacing) << BigInt(22)).toString(),
  }));
}

async function test() {
  const originalConnect = Shard.prototype.connect;
  Shard.prototype.connect = function () {
    this.status = "ready";
    this.ready = true;
  };
  const client = new Eris.Client("test", { autoShard: { cooldown: 0 }, autoreconnect: false });
  const sharder = client._autoSharder;
  let guilds = makeGuilds(1800);
  let remaining = 1000;
  let requests = 0;
  client.getBotGateway = async () => ({
    url: "wss://gateway.discord.gg",
    shards: 2,
    session_start_limit: { remaining, max_concurrency: 16 },
  });
  client.requestHandler.request = async (method, url, auth, options) => {
    assert.strictEqual(url, "/users/@me/guilds");
    ++requests;
    return guilds.filter((guild) => BigInt(guild.id) > BigInt(options.after || 0)).slice(0, options.limit);
  };
  try {
    await client.connect();
    assert.strictEqual(client.options.maxShards, 4);
    assert.strictEqual(client.shards.size, 4);
    assert.strictEqual(requests, 10);
    assert(sharder.timer);
    client.ready = true;
    client.user = { id: "bot" };

    const oldShard = client.shards.get(0);
    let event;
    client.on("reshard", (...args) => { event = args; });
    guilds = makeGuilds(2400);
    remaining = 5;
    await sharder.check();
    assert.strictEqual(client.options.maxShards, 4);

    remaining = 1000;
    client.voiceConnections.set("test", {});
    await sharder.check();
    assert.strictEqual(client.options.maxShards, 4);
    client.voiceConnections.delete("test");

    await sharder.check();
    assert.strictEqual(client.options.maxShards, 6);
    assert.strictEqual(client.shards.size, 6);
    assert.deepStrictEqual(event, [4, 6, 2400]);
    assert.notStrictEqual(client.shards.get(0), oldShard);
    client.shards.connect(oldShard);
    assert(!client.shards.connectQueue.includes(oldShard));
    assert.strictEqual(sharder.chooseCount(makeGuilds(501, 2).map((guild) => guild.id), 1), 3);
    assert.throws(() => new Eris.Client("test", { autoShard: true, lastShardID: 1 }), /complete shard range/);
  } finally {
    client.disconnect({ reconnect: false });
    assert(!sharder.timer);
    clearTimeout(client.shards.connectTimeout);
    Shard.prototype.connect = originalConnect;
  }
}

test().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
