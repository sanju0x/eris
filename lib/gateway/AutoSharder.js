"use strict";

const Endpoints = require("../rest/Endpoints");

class AutoSharder {
  constructor(client, options) {
    this.client = client;
    this.options = Object.assign({
      targetGuildsPerShard: 450,
      maxGuildsPerShard: 500,
      checkInterval: 300000,
      cooldown: 900000,
    }, options === true ? {} : options);
    const { targetGuildsPerShard, maxGuildsPerShard, checkInterval, cooldown } = this.options;
    if (![targetGuildsPerShard, maxGuildsPerShard, checkInterval, cooldown].every(Number.isSafeInteger)
      || targetGuildsPerShard < 1 || maxGuildsPerShard < targetGuildsPerShard || maxGuildsPerShard > 2500
      || checkInterval < 1000 || cooldown < 0) {
      throw new RangeError("Invalid automatic shard options");
    }
    this.minimum = client.options.maxShards === "auto" ? 1 : client.options.maxShards;
    this.timer = null;
    this.generation = 0;
    this.checking = false;
    this.lastResize = 0;
  }

  async getGuildIDs() {
    const ids = new Set();
    let after;
    for (;;) {
      const page = await this.client.requestHandler.request("GET", Endpoints.USER_GUILDS("@me"), true, {
        limit: 200,
        after,
      });
      let highest = after ? BigInt(after) : BigInt(0);
      for (const guild of page) {
        ids.add(guild.id);
        const id = BigInt(guild.id);
        if (id > highest) {
          highest = id;
        }
      }
      if (page.length < 200) {
        return Array.from(ids);
      }
      if (highest.toString() === after) {
        throw new Error("Guild pagination did not advance");
      }
      after = highest.toString();
    }
  }

  getLargestShard(epochs, count) {
    const sizes = new Map();
    let largest = 0;
    for (const epoch of epochs) {
      const shard = epoch % count;
      const size = (sizes.get(shard) || 0) + 1;
      sizes.set(shard, size);
      largest = Math.max(largest, size);
    }
    return largest;
  }

  chooseCount(ids, recommended, minimum = this.minimum) {
    if (!Number.isSafeInteger(recommended) || recommended < 1) {
      throw new Error("Invalid recommended shard count");
    }
    const epochs = ids.map((id) => Number(BigInt(id) >> BigInt(22)));
    const { targetGuildsPerShard, maxGuildsPerShard } = this.options;
    const initial = Math.max(minimum, recommended, Math.ceil(ids.length / targetGuildsPerShard));
    // Discord's mapping can be uneven; try a limited number of larger layouts.
    for (let count = initial; count < initial + 64; ++count) {
      if (this.getLargestShard(epochs, count) <= maxGuildsPerShard) {
        return count;
      }
    }
    throw new Error("Could not find a shard layout within the configured guild limit");
  }

  async prepare(data) {
    const generation = this.generation;
    const ids = await this.getGuildIDs();
    if (generation !== this.generation) {
      return;
    }
    const count = this.chooseCount(ids, data.shards);
    if (!this.hasSessionBudget(data, count)) {
      const error = new Error("Insufficient Discord session starts for automatic sharding");
      error.autoShardRetryAfter = data.session_start_limit && data.session_start_limit.reset_after;
      throw error;
    }
    this.client.options.maxShards = count;
    this.client.options.lastShardID = count - 1;
  }

  hasSessionBudget(data, count) {
    const limit = data.session_start_limit;
    return limit && Number.isSafeInteger(limit.remaining) && limit.remaining >= count
      && Number.isSafeInteger(limit.max_concurrency) && limit.max_concurrency > 0;
  }

  start() {
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.check().catch((err) => this.client.emit("warn", err));
      }, this.options.checkInterval);
      if (this.timer.unref) {
        this.timer.unref();
      }
    }
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    ++this.generation;
  }

  canResize() {
    const client = this.client;
    return client.ready && client.shards.size === client.options.maxShards
      && client.shards.every((shard) => shard.ready)
      && !client.voiceConnections.size && !Object.keys(client.voiceConnections.pendingGuilds).length
      && !client.guilds.some((guild) => {
        const voice = client.user && guild.voiceStates.get(client.user.id);
        return voice && voice.channelID;
      });
  }

  async check() {
    if (this.checking || !this.canResize() || Date.now() - this.lastResize < this.options.cooldown) {
      return;
    }
    this.checking = true;
    const generation = this.generation;
    try {
      const client = this.client;
      const ids = await this.getGuildIDs();
      const current = client.options.maxShards;
      if (generation !== this.generation || !this.canResize()) {
        return;
      }
      const epochs = ids.map((id) => Number(BigInt(id) >> BigInt(22)));
      if (this.getLargestShard(epochs, current) <= this.options.maxGuildsPerShard) {
        return;
      }
      const data = await client.getBotGateway();
      const count = this.chooseCount(ids, data.shards, current + 1);
      if (generation !== this.generation || !this.canResize()) {
        return;
      }
      if (!data.url || !this.hasSessionBudget(data, count)) {
        client.emit("warn", "Automatic reshard deferred: insufficient gateway session starts or missing gateway data");
        return;
      }
      client.emit("reshard", current, count, ids.length);
      if (generation !== this.generation || !this.canResize()) {
        return;
      }
      client.shards.resetForReshard();
      client.guilds.clear();
      client.unavailableGuilds.clear();
      client.guildShardMap = {};
      client.channelGuildMap = {};
      client.threadGuildMap = {};
      client.options.maxShards = count;
      client.options.lastShardID = count - 1;
      this.lastResize = Date.now();
      if (generation !== this.generation) {
        return;
      }
      client._connectGateway(data);
    } finally {
      this.checking = false;
    }
  }
}

module.exports = AutoSharder;
