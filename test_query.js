const mongoose = require('mongoose');
require('dotenv').config({path: 'e:/nodeJS/TengoHambre/backend/.env'});
mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Order = mongoose.model('Order', new mongoose.Schema({ businessId: mongoose.Schema.Types.ObjectId, createdAt: Date, status: String, paymentMethod: String, subtotal: Number, total: Number, stripePaymentStatus: String, dispersionId: mongoose.Schema.Types.ObjectId }, { strict: false }));
  
  const startStr = '2026-10-01T00:00:00';
  const start = new Date(startStr);
  console.log('Start Date Object:', start.toISOString(), 'Local:', start.toString());
  
  const orders = await Order.find({
      createdAt: { $gte: start },
      $or: [
          { status: { $in: ['completed', 'delivered', 'ready'] } },
          { stripePaymentStatus: 'succeeded', status: { $ne: 'cancelled' } }
      ]
  }).populate('businessId');
  
  const perros = orders.filter(o => o.businessId && o.businessId.name && o.businessId.name.toLowerCase().includes('perros'));
  console.log(`Found ${perros.length} orders for Perros in October.`);
  if (perros.length > 0) {
      console.log(perros.map(o => o.createdAt));
  }
  process.exit();
}).catch(console.error);
