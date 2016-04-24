var Peer = require('simple-peer')
var Socket = require('./socket')
var DragDrop = require('drag-drop')
var WebTorrent = require('webtorrent')

var $chat = document.querySelector('form.text')
var $count = document.querySelector('.count')
var $history = document.querySelector('.history')
var $next = document.querySelector('.next')
var $send = document.querySelector('.send')
var $textInput = document.querySelector('.text input')

var client = new WebTorrent()

function disableUI () {
  $textInput.disabled = true
  $send.disabled = true
  // $next.disabled = true
}

function enableUI () {
  $textInput.disabled = false
  $send.disabled = false
  $next.disabled = false
  $textInput.focus()
}

disableUI()

function addChat (text, className) {
  var node = document.createElement('div')
  node.textContent = text
  node.className = className
  $history.appendChild(node)
}

function clearChat () {
  $history.innerHTML = ''
}

var peer
var socket = new Socket()

DragDrop('body', function(files) {
  if (!peer) {
    console.log('No peer!')
  } else {
    console.log(files[0].name)
    console.log(files[0].type)
    client.seed(files, function(torrent) {
      console.log('Seeding torrent ' + torrent.magnetURI)
     
      addMedia(torrent.files[0], 'local') 
      
      // send to peer
      peer.send({ type: 'magnet', data: torrent.magnetURI })
    })
  }
})

function addMedia(file, className) {
  // add media to chat
  var node = document.createElement('div')
  node.className = className + ' media'
  file.appendTo(node)
  $history.appendChild(node)
}

socket.on('error', function (err) {
  console.error('[socket error]', err.stack || err.message || err)
})

socket.once('ready', function () {
  next()
})

function next (event) {
  if (event && event.preventDefault) {
    event.preventDefault()
  }
  if (peer) {
    socket.send({ type: 'end' })
    peer.close()
  }
  socket.send({ type: 'peer' })

  disableUI()
  clearChat()
  addChat('Finding a peer...', 'status')
}

$next.addEventListener('click', next)
socket.on('message:end', next)

socket.on('message:peer', function (data) {
  data = data || {}

  peer = new Peer({
    initiator: !!data.initiator,
  })

  peer.on('error', function (err) {
    console.error('peer error', err.stack || err.message || err)
  })

  peer.on('ready', function () {
    clearChat()
    addChat('Connected, say hello!', 'status')
    enableUI()
  })

  peer.on('signal', function (data) {
    socket.send({ type: 'signal', data: data })
  })

  peer.on('message:chat', function (data) {
    addChat(data, 'remote')
  })

  peer.on('message:magnet', function (data) {
    addChat('Downloading media...', 'status')
    client.add(data, function(torrent) {
      addMedia(torrent.files[0], 'remote')
    })
  })

  // Takes ~3 seconds before this event fires when peerconnection is dead (timeout)
  peer.on('close', next)
})

socket.on('message:signal', function (data) {
  peer.signal(data)
})

socket.on('message:count', function (count) {
  $count.textContent = count
})

$chat.addEventListener('submit', send)
$send.addEventListener('click', send)

function send (event) {
  event.preventDefault()
  var text = $textInput.value
  addChat(text, 'local')
  peer.send({ type: 'chat', data: text })
  $textInput.value = ''
}
