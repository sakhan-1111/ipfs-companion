'use strict'

const prefs = require('sdk/simple-prefs').prefs
const gw = require('./gateways')
const dns = require('./dns')

const {Cc, Ci} = require('chrome')

const ioservice = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
const observice = Cc['@mozilla.org/observer-service;1'].getService(Ci.nsIObserverService)

function redirectFor (uri) {
  let redirectUri = null
  if (gw.redirectEnabled) {
    let uriSpec = uri.spec
    if (uriSpec.match(gw.publicHosts) && uriSpec.match(gw.IPFS_RESOURCE)) {
      // redirect IPFS paths from known public gateways
      redirectUri = ioservice.newURI(uriSpec.replace(gw.publicHosts, gw.customUri.spec), null, null)
    } else if (prefs.dns && dns.isIpfsEnabled(uri.host)) {
      // redirect sites with dnslink record in DNS
      redirectUri = ioservice.newURI(gw.customUri.spec + 'ipns/' + uri.host + uri.path + uri.ref, null, null)
    }
  }
  // if (redirectUri) console.log('redirectFor(' + uri.spec + ')=' + redirectUri.spec)
  return redirectUri
}

const ipfsRequestObserver = {
  observe: function (subject, topic, data) { // eslint-disable-line no-unused-vars
    if (topic === 'http-on-modify-request') {
      let channel = subject.QueryInterface(Ci.nsIHttpChannel)
      let redirect = redirectFor(channel.URI)
      if (redirect) {
        channel.redirectTo(redirect)
      }
    }
  },
  register: function () {
    if (this.registered) {
      return
    }
    this.registered = true
    observice.addObserver(this, 'http-on-modify-request', false)
  },
  unregister: function () {
    if (!this.registered) {
      return
    }
    this.registered = false
    observice.removeObserver(this, 'http-on-modify-request')
  }
}

gw.onPreferencesChange(() => {
  if (gw.redirectEnabled) {
    ipfsRequestObserver.register()
  } else {
    ipfsRequestObserver.unregister()
  }
})

exports.on = ipfsRequestObserver.register
exports.off = ipfsRequestObserver.unregister

exports.ipfsRequestObserver = ipfsRequestObserver