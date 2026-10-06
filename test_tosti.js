const mongoose = require('mongoose');
require('dotenv').config({path: 'e:/nodeJS/TengoHambre/backend/.env'});
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Business = mongoose.model('Business', new mongoose.Schema({ name: String }, { strict: false }));
  const Order = mongoose.model('Order', new mongoose.Schema({ businessId: mongoose.Schema.Types.ObjectId, createdAt: Date, status: String, paymentMethod: String, subtotal: Number, total: Number, stripePaymentStatus: String, dispersionId: mongoose.Schema.Types.ObjectId }, { strict: false }));
  
  const b = await Business.findOne({ name: /Tosti/i });
  console.log('Business:', b._id, b.name);
  
  const start = new Date('2026-10-01T00:00:00');
  const end = new Date('2026-10-31T23:59:59');
  
  const orders = await Order.find({ businessId: b._id, createdAt: { $gte: start, $lte: end } });
  console.log(`Found ${orders.length} orders for ${b.name} in October.`);
  if (orders.length > 0) {
      console.log(orders.map(o => ({
          id: o._id,
          createdAt: o.createdAt,
          status: o.status,
          method: o.paymentMethod,
          stripeStatus: o.stripePaymentStatus
      })));
  }
  process.exit();
}).catch(console.error);
