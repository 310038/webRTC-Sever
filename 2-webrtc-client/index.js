const PORT = 3001
const ip = '10.251.42.48';

let myInfo = {}

let socket = null
let socketId = 0
let roomId = 0
let pc = null
let localStream = null
const rooms = new Map()

initSocket()
initClickEvent()

function initClickEvent() {
  document.getElementById('submit-btn').addEventListener('click', function () {
    const roomId = document.querySelector('#room').value
    
    const userName = document.querySelector('#user-name').value
    if (!roomId || !userName) {
      alert('房間ID或姓名不能為空')
      return
    }
    myInfo = { roomId, userName, socketId }
    console.log(`myInfo`,myInfo);
    joinRoom(myInfo)
  })

  const chatBtn = document.getElementById('chat-btn')
  chatBtn.addEventListener('click', function () {
    requestVideoCall()
    chatBtn.setAttribute('disabled', true)
  })
}

// 初始化socket事件
function initSocket() {
  socket = io(`http://${ip}:${PORT}`)
  socket.on('connected', onConnected)
  socket.on('room_created', onCreateRoom)
  socket.on('room_joined', onJoinRoomSuccess)
  socket.on('room_full', onJoinRoomFail)
  socket.on('receive_video', onReceiveVideo)
  socket.on('accept_video', onAcceptVideo)
  socket.on('receive_offer', onReceiveOffer)
  socket.on('receive_answer', onReceiveAnswer)
  socket.on('add_candidate', onAddCandidate)
}

// 連接 WebSocket 成功
function onConnected(id) {
  socketId = id
  console.log(`連接成功，socketId為${socketId}`)
}

// 建立並加入空房間
function onCreateRoom() {
  alert(`你已建立並加入【${myInfo.roomId}】房間`)
  showChatContainer()
}

// 加入房間成功
function onJoinRoomSuccess(existUser) {
  showChatContainer()
  const { userName, roomId, socketId } = existUser

  // 目前使用者加入房間可不提示
  if (socketId !== myInfo.socketId) {
    console.log(`使用者${userName}已加入【${roomId}】房間`)
  }
}

// 房間已滿
function onJoinRoomFail() {
  alert('房間已滿，請更換房間號碼ID')
}

// 收到視訊通話申請
function onReceiveVideo(userInfo) {
  if (myInfo.socketId === userInfo.socketId) return

  if (window.confirm(`你要接收該用戶${userInfo.userName}的視訊通話邀請嗎？`)) {
    acceptVideoCall()
  } else {
  }
}

// 用戶接聽視頻
async function onAcceptVideo(userInfo) {
  document.getElementById('chat-btn').setAttribute('disabled', true)
  await createLocalMediaStream()
  createPeerConnection()
  if (userInfo.socketId !== myInfo.socketId) {
    await sendOffer()
  }
}

// 收到 offer 信令後應答
async function onReceiveOffer(offer) {
  if (!pc) return
  await pc.setRemoteDescription(offer)
  const answer = await pc.createAnswer()
  pc.setLocalDescription(answer)
  socket.emit('answer', { answer, userInfo: myInfo })
}

// 收到 answer 信令後
async function onReceiveAnswer(answer) {
  await pc.setRemoteDescription(answer)
}

async function onAddCandidate(candidate) {
  await pc.addIceCandidate(candidate)
}

// 加入房間
function joinRoom(message) {
  socket.emit('create_or_join_room', message)
}

// 發起視訊通話
function requestVideoCall() {
  socket.emit('request_video', myInfo)
}

// 用戶接聽視頻
function acceptVideoCall() {
  socket.emit('accept_video', myInfo)
}

// 建立本地媒體串流
async function createLocalMediaStream() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false,
  })
  document.getElementById('local-video').srcObject = localStream
}

// 建立點對點連接
function createPeerConnection() {
  if (!pc) {
    pc = new RTCPeerConnection()
  }

  pc.onicecandidate = onIceCandidate
  pc.oniceconnectionstatechange = onIceConnectionStateChange
  pc.ontrack = onTrack
  pc.onicegatheringstatechange = onicegatheringstatechange

  localStream.getTracks().forEach((track) => {
    pc.addTrack(track, localStream)
  })
}

function onIceCandidate(event) {
  console.log('onIceCandidate', event, event.candidate)
  if (event.candidate) {
    socket.emit('add_candidate', { candidate: event.candidate, userInfo: myInfo })
  }
}

function onIceConnectionStateChange(event) {
  console.log(`oniceconnectionstatechange, pc.iceConnectionState is ${pc.iceConnectionState}.`)
}

function onTrack(event) {
  document.getElementById('remote-video').srcObject = event.streams[0]
  console.log('onTrack', event)
}

function onicegatheringstatechange() {
  console.log(`onicegatheringstatechange, pc.iceGatheringState is ${pc.iceGatheringState}.`)
}

// 發送方創建 offer
async function sendOffer() {
  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  socket.emit('offer', { offer, userInfo: myInfo })
}

function showChatContainer() {
  document.getElementById('form').style.display = 'none'
  document.getElementById('chat-container').style.display = 'block'
}


//聊天
