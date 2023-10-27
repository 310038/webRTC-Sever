const Koa = require('koa')
const http = require('http')
const { Server } = require('socket.io')
const EventNames = require('./constants')

const PORT = 3001
// const ip = '10.251.42.48';
const ip = '192.168.251.104';
const app = new Koa()
const server = http.createServer(app.callback()).listen(PORT,ip, () => {
  console.log(`WebRTC server run at: http://${ip}:${PORT}`)
})
// const server = http.createServer(app.callback()).listen('3001', () => {
//   console.log(`WebRTC server run at: http://localhost:3001`)
// })

const rooms = new Map()
const socketInstances = {}

const io = new Server(server, {
  cors: {
    origin: '*',
  },
})

io.on('connection', (socket) => {
  socket.emit('connected', socket.id)

  // 創建或加入房間
  socket.on(EventNames.CREATE_OR_JOIN_ROOM, (userInfo) => {
    const { roomId, socketId } = userInfo
    const curRoomUsers = rooms.get(roomId) || [] // 獲取該房間的用戶

    if (curRoomUsers.length >= 2) {
      socket.emit(EventNames.ROOM_FULL, roomId)
      return
    } else if (curRoomUsers.length === 0) {
      socket.join(roomId)
      io.to(roomId).emit(EventNames.ROOM_CREATED)
      rooms.set(roomId, [userInfo])
    } else {
      socket.join(roomId)
      io.to(roomId).emit(EventNames.ROOM_JOINED, userInfo)
      rooms.set(roomId, [...curRoomUsers, userInfo])
    }
    socketInstances[socketId] = socket
  })

  // 發起視訊通話
  socket.on(EventNames.REQUEST_VIDEO, (userInfo) => {
    io.in(userInfo.roomId).emit(EventNames.RECEIVE_VIDEO, userInfo)
  })

  // 收到視訊通話邀請
  socket.on(EventNames.RECEIVE_VIDEO, (userInfo) => {
    io.in(userInfo.roomId).emit(EventNames.RECEIVE_VIDEO, userInfo)
  })

  // 用戶同意接受視訊通話
  socket.on(EventNames.ACCEPT_VIDEO, (userInfo) => {
    io.in(userInfo.roomId).emit(EventNames.ACCEPT_VIDEO, userInfo)
  })

  // 收到 offer
  socket.on(EventNames.OFFER, (data) => {
    const { socketId, roomId } = data.userInfo
    const peerUser = rooms.get(roomId).find((item) => item.socketId !== socketId)
    socketInstances[peerUser.socketId].emit(EventNames.RECEIVE_OFFER, data.offer)
  })

  // 收到 answer
  socket.on(EventNames.ANSWER, (data) => {
    const { socketId, roomId } = data.userInfo
    const peerUser = rooms.get(roomId).find((item) => item.socketId !== socketId)
    socketInstances[peerUser.socketId].emit(EventNames.RECEIVE_ANSWER, data.answer)
  })

  socket.on(EventNames.ADD_CANDIDATE, (data) => {
    const { socketId, roomId } = data.userInfo
    const peerUser = rooms.get(roomId).find((item) => item.socketId !== socketId)
    socketInstances[peerUser.socketId].emit(EventNames.ADD_CANDIDATE, data.candidate)
  })
})
