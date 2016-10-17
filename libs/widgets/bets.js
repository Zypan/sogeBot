'use strict'

var _ = require('lodash')
var log = global.log

function BetsWidget () {
  global.panel.addWidget('bets', 'Bets', 'knight')
  global.panel.socketListening(this, 'getBetsTemplates', this.getBetsTemplates)
  global.panel.socketListening(this, 'getRunningBet', this.getRunningBet)
  global.panel.socketListening(this, 'closeBet', this.closeBet)
  global.panel.socketListening(this, 'reuseBet', this.reuseBet)
  global.panel.socketListening(this, 'removeBetTemplate', this.removeBetTemplate)
}

BetsWidget.prototype.getBetsTemplates = function (self, socket) {
  global.botDB.findOne({ _id: 'bets_template' }, function (err, item) {
    if (err) log.error(err)
    if (!_.isNull(item)) {
      socket.emit('betsTemplates', item.options)
    }
  })
}

BetsWidget.prototype.getRunningBet = function (self, socket) {
  global.botDB.findOne({_id: 'bet'}, function (err, item) {
    if (err) log.error(err)
    if (_.isNull(item)) socket.emit('runningBet', null)
    else {
      item.timerEnd = global.systems.bets.timerEnd
      socket.emit('runningBet', item)
    }
  })
}

BetsWidget.prototype.closeBet = function (self, socket, option) {
  global.parser.parse({username: global.configuration.get().twitch.owner}, '!bet ' + (option === 'refund' ? option : 'close ' + option))
}

BetsWidget.prototype.reuseBet = function (self, socket, options) {
  global.parser.parse({username: global.configuration.get().twitch.owner}, '!bet open ' + options.join(' '))
}

BetsWidget.prototype.removeBetTemplate = function (self, socket, options) {
  global.botDB.update({ _id: 'bets_template' }, { $pull: { options: options } }, {})
}

module.exports = new BetsWidget()
