const http = require('http');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Socket.IO server is running');
});

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

const drivers = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('driver_register', (payload = {}) => {
    const driverId = payload.driverId || `driver-${socket.id}`;
    drivers.set(socket.id, { ...payload, driverId, socketId: socket.id });
    console.log('Driver registered:', driverId);

    socket.emit('driver_registered', {
      ok: true,
      driverId,
      message: 'Driver registered successfully',
    });
  });

  socket.on('order_accepted', (payload = {}) => {
    console.log('Order accepted:', payload);

    socket.emit('order_status_updated', {
      ok: true,
      status: 'accepted',
      orderId: payload.orderId,
    });
  });

  socket.on('order_rejected', (payload = {}) => {
    console.log('Order rejected:', payload);

    socket.emit('order_status_updated', {
      ok: true,
      status: 'rejected',
      orderId: payload.orderId,
    });
  });

  socket.on('disconnect', () => {
    if (drivers.has(socket.id)) {
      drivers.delete(socket.id);
    }
    console.log('Client disconnected:', socket.id);
  });
});

function emitDeliveryRequest(payload) {
  io.emit('new_delivery_request', payload);
}

server.listen(PORT, () => {
  console.log(`Socket.IO server listening on port ${PORT}`);
});

module.exports = {
  app: server,
  io,
  emitDeliveryRequest,
};
