'use strict'

var _ = require('lodash')
var Database = require('nedb-promise')
var DB = new Database({
  filename: './sogeBot.db',
  autoload: true
})

async function clean_users () {
  let users = await DB.findOne({ _id: 'users' })
  let size = _.size(users.users)

  users = _.filter(users.users, function (o) {
    return !_.isNil(o.time) && !_.isNil(o.time.watched) && o.time.watched > 0
  })

  let newUsers = {}
  for (var i = 0, len = users.length; i < len; i++) {
    let username = users[i].username
    newUsers[username] = users[i]
  }
  users = {
    _id: 'users',
    users: newUsers
  }
  await DB.remove({ _id: 'users' })
  await DB.insert(users)
  console.log('Cleaned ' + (size - _.size(users.users) + ' users'))
}

async function clean_users_without_id () {
  let users = await DB.findOne({ _id: 'users' })
  let size = _.size(users.users)

  users = _.filter(users.users, function (o) {
    return !_.isNil(o.id)
  })

  let newUsers = {}
  for (var i = 0, len = users.length; i < len; i++) {
    let username = users[i].username
    newUsers[username] = users[i]
  }

  users = {
    _id: 'users',
    users: newUsers
  }
  await DB.remove({ _id: 'users' })
  await DB.insert(users)
  console.log('Cleaned ' + (size - _.size(users.users) + ' users'))
}

async function main () {
  console.log('Cleaning up users without watched time')
  await clean_users()
  console.log('- DONE')

  console.log('Cleaning up users without id')
  await clean_users_without_id()
  console.log('- DONE')
}

main()
