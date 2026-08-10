const { emitDeliveryRequest } = require('./socket-server');

const sampleRequest = {
  id: 'order-123',
  pickupStoreName: 'City Market',
  totalDistance: '6.2 km',
  payout: 'ETB 260',
  customerName: 'Aster Bekele',
  customerLocation: { latitude: 8.9806, longitude: 38.7578 },
  storeLocation: { latitude: 8.9855, longitude: 38.7634 },
  driverCoordinates: { latitude: 8.9806, longitude: 38.7578 },
};

setTimeout(() => {
  emitDeliveryRequest(sampleRequest);
  console.log('Sample delivery request emitted');
}, 2000);
