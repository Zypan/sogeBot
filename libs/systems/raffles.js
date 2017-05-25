'use strict'

// 3rdparty libraries
var _ = require('lodash')
// bot libraries
var constants = require('../constants')
var log = global.log

/*
 * !raffle                                                      - gets an info about raffle
 * !raffle open [raffle-keyword] [product] [time=#] [followers] - open a new raffle with selected keyword for specified product (optional), time=# (optional) - minimal watched time in minutes, for followers? (optional)
 * !raffle close                                                - close a raffle manually
 * !raffle pick                                                 - pick or repick a winner of raffle
 * ![raffle-keyword]                                            - join a raffle
 * !set raffleAnnounceInterval [minutes]                        - reannounce raffle interval each x minutes
 */

function Raffles () {
  if (global.commons.isSystemEnabled(this)) {
    this.lastAnnounce = 0
    this.keyword = null
    this.product = null
    this.minWatchedTime = 0
    this.minTickets = 0
    this.maxTickets = 1000
    this.eligibility = 0
    this.type = 0
    this.status = null

    global.parser.register(this, '!raffle pick', this.pick, constants.OWNER_ONLY)
    global.parser.register(this, '!raffle close', this.close, constants.OWNER_ONLY)
    global.parser.register(this, '!raffle open', this.open, constants.OWNER_ONLY)
    global.parser.register(this, '!raffle', this.info, constants.VIEWERS)
    global.parser.registerHelper('!raffle')
    global.configuration.register('raffleAnnounceInterval', 'raffle.announceInterval', 'number', 10)
    global.configuration.register('raffleAnnounceCustomMessage', 'raffle.announceCustomMessage', 'string', '')
    global.configuration.register('raffleTitleTemplate', 'raffle.announceTitleTemplate', 'string', '')

    var self = this
    setInterval(function () {
      if (new Date().getTime() < self.lastAnnounce + (global.configuration.getValue('raffleAnnounceInterval') * 60 * 1000) || _.isNil(self.keyword)) return
      self.lastAnnounce = new Date().getTime()
      let message
      if (global.configuration.getValue('raffleAnnounceCustomMessage').length > 0) {
        message = global.configuration.getValue('raffleAnnounceCustomMessage')
          .replace('(keyword)', self.keyword)
          .replace('(product)', self.product)
          .replace('(min)', self.minTickets)
          .replace('(max)', self.maxTickets)
      } else {
        if (self.eligibility === 0 && self.product) {
          message = global.translate(self.type === 0 ? 'raffle.open.notice.followersAndProduct' : 'raffle.open.notice.followersAndProductTickets')
            .replace('(keyword)', self.keyword)
            .replace('(product)', self.product)
            .replace('(min)', self.minTickets)
            .replace('(max)', self.maxTickets)
        } else if (self.eligibility === 0 && !self.product) {
          message = global.translate(self.type === 0 ? 'raffle.open.notice.followers' : 'raffle.open.notice.followersTickets')
            .replace('(keyword)', self.keyword)
            .replace('(min)', self.minTickets)
            .replace('(max)', self.maxTickets)
        } else if (self.eligibility === 1 && self.product) {
          message = global.translate(self.type === 0 ? 'raffle.open.notice.subscribersAndProduct' : 'raffle.open.notice.subscribersAndProductTickets')
            .replace('(keyword)', self.keyword)
            .replace('(product)', self.product)
            .replace('(min)', self.minTickets)
            .replace('(max)', self.maxTickets)
        } else if (self.eligibility === 1 && !self.product) {
          message = global.translate(self.type === 0 ? 'raffle.open.notice.subscribers' : 'raffle.open.notice.subscribersTickets')
            .replace('(keyword)', self.keyword)
            .replace('(min)', self.minTickets)
            .replace('(max)', self.maxTickets)
        } else if (self.eligibility === 2 && self.product) {
          message = global.translate(self.type === 0 ? 'raffle.open.notice.everyoneAndproduct' : 'raffle.open.notice.everyoneAndproductTickets')
            .replace('(keyword)', self.keyword)
            .replace('(product)', self.product)
            .replace('(min)', self.minTickets)
            .replace('(max)', self.maxTickets)
        } else {
          message = global.translate(self.type === 0 ? 'raffle.open.notice.everyone' : 'raffle.open.notice.everyoneTickets')
            .replace('(keyword)', self.keyword)
            .replace('(min)', self.minTickets)
            .replace('(max)', self.maxTickets)
        }
      }

      if (self.minWatchedTime > 0) {
        message += ' ' + global.translate('raffle.minWatchedTime').replace('(time)', self.minWatchedTime)
      }
      global.commons.sendMessage(message + '.', { username: null }, { force: true })
    }, 10000)

    this.registerRaffleKeyword(this)
  }
}

Raffles.prototype.registerRaffleKeyword = function (self) {
  if (!_.isNull(self.keyword)) global.parser.unregister('!' + self.keyword)
  global.botDB.findOne({_id: 'raffle'}, function (err, item) {
    if (err) return log.error(err, { fnc: 'Raffles.prototype.registerRaffleKeyword' })
    if (!_.isNull(item)) {
      global.parser.register(this, '!' + item.keyword, self.participate, constants.VIEWERS)
      self.keyword = item.keyword
      self.product = item.product
      self.eligibility = item.eligibility
      self.type = item.type
      self.minTickets = item.minTickets
      self.maxTickets = item.maxTickets
      self.minWatchedTime = item.minWatchedTime
    }
  })
}

Raffles.prototype.pick = function (self, sender) {
  global.botDB.find({ $where: function () { return this._id.startsWith('raffle_participant_') && this.eligible } }, function (err, items) {
    if (err) return log.error(err, { fnc: 'Raffles.prototype.pick' })
    var winner = { username: null }
    if (items.length !== 0) {
      winner = _.sample(items)
      global.botDB.update({ _id: winner._id }, { $set: { eligible: false } }) // don't want to pick same winner 2 times
    }

    if (_.isNull(winner.username)) {
      global.commons.sendMessage(global.translate('raffle.pick.noParticipants'), sender)
    } else {
      const user = global.users.get(winner.username)
      global.botDB.update({_id: 'raffle'}, {$set: { winner: user, locked: true, timestamp: new Date().getTime() }})
      global.commons.sendMessage(global.translate(!_.isNil(self.product) ? 'raffle.pick.winner.withProduct' : 'raffle.pick.winner.withoutProduct')
        .replace('(winner)', winner.username)
        .replace('(product)', winner.username), sender)
      global.parser.unregister('!' + self.keyword)
      global.widgets.raffles.sendWinner(global.widgets.raffles, user)
      clearInterval(self.timer)
    }
  })
}

Raffles.prototype.participate = function (self, sender) {
  global.botDB.findOne({_id: 'raffle'}, function (err, item) {
    if (err) return log.error(err, { fnc: 'Raffles.prototype.participate' })
    if (!_.isNull(item) && !item.locked) {
      var participant = { _id: 'raffle_participant_' + sender.username,
        eligible: true,
        forced: false,
        username: sender.username }

      const user = global.users.get(sender.username)
      if (item.eligibility === 0) {
        participant.eligible = _.isUndefined(user.is.follower) ? false : user.is.follower
      }
      if (item.eligibility === 1) {
        participant.eligible = _.isUndefined(user.is.subscriber) ? false : user.is.subscriber
      }

      if (participant.eligible && item.minWatchedTime > 0) {
        participant.eligible = !_.isUndefined(user.time.watched) && (user.time.watched - 3600000) > 0
      }

      sender['message-type'] = 'whisper'
      if (participant.eligible) {
        global.commons.sendMessage(global.translate('raffle.participation.success'), sender)
        global.botDB.insert(participant)
      } else {
        global.commons.sendMessage(global.translate('raffle.participation.failed'), sender)
      }
    }
  })
}

Raffles.prototype.info = function (self, sender) {
  global.botDB.findOne({_id: 'raffle'}, function (err, item) {
    if (err) return log.error(err, { fnc: 'Raffles.prototype.info' })
    if (!_.isNull(item)) {
      if (!_.isNull(item.winner)) global.commons.sendMessage(global.translate('raffle.info.notRunning'), sender)
      else if (!item.locked) {
        let message
        if (item.eligibility === 0 && item.product) {
          message = global.translate(item.type === 0 ? 'raffle.info.opened.followersAndProduct' : 'raffle.info.opened.followersAndProductTickets')
            .replace('(keyword)', item.keyword)
            .replace('(product)', item.product)
            .replace('(min)', item.minTickets)
            .replace('(max)', item.maxTickets)
        } else if (item.eligibility === 0 && !item.product) {
          message = global.translate(item.type === 0 ? 'raffle.info.opened.followers' : 'raffle.info.opened.followersTickets')
            .replace('(keyword)', item.keyword)
            .replace('(min)', item.minTickets)
            .replace('(max)', item.maxTickets)
        } else if (item.eligibility === 1 && item.product) {
          message = global.translate(item.type === 0 ? 'raffle.info.opened.subscribersAndProduct' : 'raffle.info.opened.subscribersAndProductTickets')
            .replace('(keyword)', item.keyword)
            .replace('(product)', item.product)
            .replace('(min)', item.minTickets)
            .replace('(max)', item.maxTickets)
        } else if (item.eligibility === 1 && !item.product) {
          message = global.translate(item.type === 0 ? 'raffle.info.opened.subscribers' : 'raffle.info.opened.subscribersTickets')
            .replace('(keyword)', item.keyword)
            .replace('(min)', item.minTickets)
            .replace('(max)', item.maxTickets)
        } else if (item.eligibility === 2 && item.product) {
          message = global.translate(item.type === 0 ? 'raffle.info.opened.everyoneAndProduct' : 'raffle.info.opened.everyoneAndProductTickets')
            .replace('(keyword)', item.keyword)
            .replace('(product)', item.product)
            .replace('(min)', item.minTickets)
            .replace('(max)', item.maxTickets)
        } else {
          message = global.translate(item.type === 0 ? 'raffle.info.opened.everyone' : 'raffle.info.opened.everyoneTickets')
            .replace('(keyword)', item.keyword)
            .replace('(min)', item.minTickets)
            .replace('(max)', item.maxTickets)
        }

        if (item.minWatchedTime > 0) {
          message += ' ' + global.translate('raffle.minWatchedTime').replace('(time)', item.minWatchedTime)
        }
        global.commons.sendMessage(message + '.', sender)
      } else {
        global.commons.sendMessage(global.translate('raffle.info.closed'), sender)
      }
    } else {
      global.commons.sendMessage(global.translate('raffle.info.notRunning'), sender)
    }
  })
}

Raffles.prototype.open = function (self, sender, text, dashboard = false) {
  try {
    let eligibility = 2

    if (text.indexOf('followers') >= 0) {
      text = text.replace('followers', '').trim()
      eligibility = 0
    }
    if (text.indexOf('subscribers') >= 0) {
      text = text.replace('subscribers', '').trim()
      eligibility = 1
    }

    // check if time is set
    let minWatchedTime = 0
    for (let part of text.trim().split(' ')) {
      if (part.startsWith('time=')) {
        minWatchedTime = part.replace('time=', '')
        break
      }
    }
    text = text.replace('time=' + minWatchedTime, '')

    let type = 0
    for (let part of text.trim().split(' ')) {
      if (part.startsWith('type=')) {
        type = part.replace('type=', '') === 'keyword' ? 0 : 1
        break
      }
    }
    text = text.replace('type=' + (type === 0 ? 'keyword' : 'tickets'), '')

    let minTickets = 0
    for (let part of text.trim().split(' ')) {
      if (part.startsWith('min=')) {
        minTickets = part.replace('min=', '')
        break
      }
    }
    text = text.replace('min=' + minTickets, '')

    let maxTickets = 1000
    for (let part of text.trim().split(' ')) {
      if (part.startsWith('max=')) {
        maxTickets = part.replace('max=', '')
        break
      }
    }
    text = text.replace('max=' + maxTickets, '')

    var parsed = text.trim().match(/^([\u0500-\u052F\u0400-\u04FF\w]+) ?(.*)?/)
    var groups = { keyword: 1, product: 2 }
    var raffle = {
      keyword: parsed[groups.keyword],
      eligibility: eligibility,
      product: !_.isNil(parsed[groups.product]) ? parsed[groups.product] : '',
      minWatchedTime: minWatchedTime,
      type: type,
      minTickets: minTickets,
      maxTickets: maxTickets,
      winner: null,
      locked: false
    }

    // check if keyword is free
    if (global.parser.isRegistered(raffle.keyword)) {
      global.commons.sendMessage(global.translate('core.isRegistered').replace('(keyword)', '!' + raffle.keyword), sender)
      return
    }

    global.botDB.update({_id: 'raffle'}, {$set: raffle}, {upsert: true}, function (err) {
      if (err) return log.error(err, { fnc: 'Raffles.prototype.open' })

      let message
      if (raffle.eligibility === 0 && raffle.product) {
        message = global.translate(raffle.type === 0 ? 'raffle.open.ok.followersAndProduct' : 'raffle.open.ok.followersAndProductTickets')
          .replace('(keyword)', raffle.keyword)
          .replace('(product)', raffle.product)
          .replace('(min)', raffle.minTickets)
          .replace('(max)', raffle.maxTickets)
      } else if (raffle.eligibility === 0 && !raffle.product) {
        message = global.translate(raffle.type === 0 ? 'raffle.open.ok.followers' : 'raffle.open.ok.followersTickets')
          .replace('(keyword)', raffle.keyword)
          .replace('(min)', raffle.minTickets)
          .replace('(max)', raffle.maxTickets)
      } else if (raffle.eligibility === 1 && raffle.product) {
        message = global.translate(raffle.type === 0 ? 'raffle.open.ok.subscribersAndProduct' : 'raffle.open.ok.subscribersAndProductTickets')
          .replace('(keyword)', raffle.keyword)
          .replace('(product)', raffle.product)
          .replace('(min)', raffle.minTickets)
          .replace('(max)', raffle.maxTickets)
      } else if (raffle.eligibility === 1 && !raffle.product) {
        message = global.translate(raffle.type === 0 ? 'raffle.open.ok.subscribers' : 'raffle.open.ok.subscribersTickets')
          .replace('(keyword)', raffle.keyword)
          .replace('(min)', raffle.minTickets)
          .replace('(max)', raffle.maxTickets)
      } else if (raffle.eligibility === 2 && raffle.product) {
        message = global.translate(raffle.type === 0 ? 'raffle.open.ok.everyoneAndProduct' : 'raffle.open.ok.everyoneAndProductTickets')
          .replace('(keyword)', raffle.keyword)
          .replace('(product)', raffle.product)
          .replace('(min)', raffle.minTickets)
          .replace('(max)', raffle.maxTickets)
      } else {
        message = global.translate(raffle.type === 0 ? 'raffle.open.ok.everyone' : 'raffle.open.ok.everyoneTickets')
          .replace('(keyword)', raffle.keyword)
          .replace('(min)', raffle.minTickets)
          .replace('(max)', raffle.maxTickets)
      }

      if (raffle.minWatchedTime > 0) {
        message += ' ' + global.translate('raffle.minWatchedTime').replace('(time)', raffle.minWatchedTime)
      }
      global.commons.sendMessage(message + '.', sender)

      if (!dashboard) {
        // remove any participants - don't delete in dashboard
        global.botDB.remove({ $where: function () { return this._id.startsWith('raffle_participant_') } }, { multi: true })
      }

      // register raffle keyword
      self.registerRaffleKeyword(self)
      self.lastAnnounce = new Date().getTime()
      if (global.configuration.getValue('raffleTitleTemplate').trim().length > 0) {
        self.status = global.twitch.currentStatus
        global.twitch.setTitle(global.twitch, null, self.status + ' ' + global.configuration.getValue('raffleTitleTemplate').replace('(product)', !raffle.product ? ' ' : raffle.product).replace('(keyword)', raffle.keyword))
      }
    })
  } catch (err) {
    global.commons.sendMessage(global.translate('raffle.open.error'))
  }
}

Raffles.prototype.close = function (self, sender, text) {
  if (!_.isNil(self.status)) {
    global.twitch.setTitle(global.twitch, null, self.status)
    self.status = null
  }

  global.botDB.findOne({_id: 'raffle'}, function (err, item) {
    if (err) return log.error(err, { fnc: 'Raffles.prototype.close' })
    if (!_.isNull(item)) {
      global.botDB.update({_id: 'raffle'}, {$set: {locked: true}}, {}, function (err) {
        if (err) return log.error(err, { fnc: 'Raffles.prototype.close' })
        global.commons.sendMessage(global.translate('raffle.close.ok'), sender)
      })

      clearInterval(self.timer)
      global.parser.unregister('!' + item.keyword)
    } else {
      global.commons.sendMessage(global.translate('raffle.close.notRunning'), sender)
    }
  })
}

module.exports = new Raffles()
