'use strict'

var _ = require('lodash')
var Database = require('nedb-promise')
var DB = new Database({
  filename: 'sogeBot.db',
  autoload: true
})

var migration = {
  '1.1': {
    description: '1.0 to 1.1',
    process: async function () {
      console.log('-> Renaming settings')
      await settingsRename('volume', 'songs_volume')
      await settingsRename('duration', 'songs_duration')
      await settingsRename('shuffle', 'songs_shuffle')
    }
  },
  '1.3': {
    description: '1.1 to 1.3',
    process: async function () {
      console.log('-> Removing bet templates')
      await removeFromDB('bets_template')
      console.log('-> Alias table update')
      await aliasDbUpdate_1_3()
      console.log('-> Custom Commands update')
      await customCmdsDbUpdate_1_3()
      console.log('-> Keywords update')
      await keywordsDbUpdate_1_3()
      console.log('-> Users update')
      await usersDbUpdate_1_3()
      console.log('-> Prices update')
      await pricesDbUpdate_1_3()
      console.log('-> Notices update')
      await noticesDbUpdate_1_3()
    }
  }
}

async function main () {
  await migrate('1.1')
  await migrate('1.3')
  console.log('=> EVERY PROCESS IS DONE')
  process.exit()
}

async function migrate (aVersion) {
  console.log('Migration from %s', migration[aVersion].description)
  await migration[aVersion].process()
  console.log('=> DONE')
}

main();

async function settingsRename(aOrig, aRenamed) {
  let setting = await DB.findOne({
    $where: function () {
      return this.type === 'settings' && Object.keys(this).indexOf(aOrig) >= 0;
    }
  })
  if (!_.isNull(setting)) {
    setting[aRenamed] = setting[aOrig]
    await DB.remove({ _id: setting._id})
    delete setting[aOrig]
    delete setting._id
    await DB.insert(setting)
  }
}

async function aliasDbUpdate_1_3() {
  let aliases = await DB.find({
    $where: function () {
      return this._id.startsWith('alias_')
    }
  })
  if (aliases.length === 0) return

  let aliasUpdate = { alias: []}
  _.each(aliases, function (alias) {
    DB.remove({_id: alias._id})
    aliasUpdate.alias.push({alias: alias.alias, command: alias.command, enabled: true})
  })
  await DB.update({ _id: 'alias' }, { $set: aliasUpdate }, { upsert: true })
}

async function pricesDbUpdate_1_3() {
  let prices = await DB.find({
    $where: function () {
      return this._id.startsWith('price_')
    }
  })
  if (prices.length === 0) return

  let pricesUpdate = { prices: []}
  _.each(prices, function (price) {
    DB.remove({_id: price._id})
    pricesUpdate.prices.push({price: price.price, command: price.command, enabled: true})
  })
  await DB.update({ _id: 'prices' }, { $set: pricesUpdate }, { upsert: true })
}

async function customCmdsDbUpdate_1_3() {
  let commands = await DB.find({
    $where: function () {
      return this._id.startsWith('customcmds_')
    }
  })
  if (commands.length === 0) return

  let commandsUpdate = { commands: []}
  _.each(commands, function (command) {
    commandsUpdate.commands.push({command: command.command, response: command.response, enabled: true})
  })
  await DB.remove({
    $where: function () {
      return this._id.startsWith('customcmds_')
    }
  }, { multi: true })
  await DB.update({ _id: 'commands' }, { $set: commandsUpdate }, { upsert: true })
}

async function removeFromDB(id) {
  await DB.remove({ _id: id })
}

async function keywordsDbUpdate_1_3() {
  let kwds = await DB.find({
    $where: function () {
      return this._id.startsWith('kwd_')
    }
  })
  if (kwds.length === 0) return

  let kwdsUpdate = { keywords: [] }
  _.each(kwds, function (kwd) {
    kwdsUpdate.keywords.push({keyword: kwd.keyword, response: kwd.response, enabled: true})
  })
  await DB.remove({
    $where: function () {
      return this._id.startsWith('kwd_')
    }
  }, { multi: true })
  await DB.update({ _id: 'keywords' }, { $set: kwdsUpdate }, { upsert: true })
}

async function noticesDbUpdate_1_3() {
  let list = await DB.find({
    $where: function () {
      return this._id.startsWith('notice_')
    }
  })
  if (list.length === 0) return

  let listUpdate = { notices: [] }
  _.each(list, function (o) {
    listUpdate.notices.push({text: o.text, time: o.time, id: o._id.split('_')[1], enabled: true})
  })
  await DB.remove({
    $where: function () {
      return this._id.startsWith('notice_')
    }
  }, { multi: true })
  await DB.update({ _id: 'notices' }, { $set: listUpdate }, { upsert: true })
}

async function removeFromDB(id) {
  await DB.remove({ _id: id })
}

async function usersDbUpdate_1_3() {
  let users = await DB.find({
    $where: function () {
      return this._id.startsWith('user_')
    }
  })
  if (users.length === 0) return

  let usersUpdate = { users: {} }
  _.each(users, function (user) {
    delete user._id

    let time = {
      message: (_.isUndefined(user.lastMessageTime)) ? 0 : user.lastMessageTime,
      watched: (_.isUndefined(user.watchTime)) ? 0 : user.watchTime,
      parted: (_.isUndefined(user.partedTime)) ? 0 : user.partedTime,
      points: (_.isUndefined(user.pointsGrantedAt)) ? 0 : user.pointsGrantedAt
    }
    delete user.lastMessageTime
    delete user.watchTime
    delete user.partedTime
    delete user.pointsGrantedAt
    user.time = time

    let is = {
      online: false,
      follower: (_.isUndefined(user.isFollower)) ? false : user.isFollower
    }
    delete user.isOnline
    delete user.isFollower
    user.is = is

    usersUpdate.users[user.username] = user
  })
  await DB.remove({
    $where: function () {
      return this._id.startsWith('user_')
    }
  }, { multi: true })
  await DB.update({ _id: 'users' }, { $set: usersUpdate }, { upsert: true })
}

async function removeFromDB(id) {
  await DB.remove({ _id: id })
}