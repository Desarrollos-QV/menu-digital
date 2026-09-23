const mongoose = require('mongoose');
const Order = require('./models/Order');

async function test() {
    await mongoose.connect('mongodb://127.0.0.1:27017/tengohambre');
    const all = await Order.countDocuments();
    const uncut1 = await Order.countDocuments({ dispersionId: { $exists: false }, status: { $in: ['completed', 'delivered', 'ready'] } });
    const uncut2 = await Order.countDocuments({ dispersionId: null, status: { $in: ['completed', 'delivered', 'ready'] } });
    
    console.log("All orders:", all);
    console.log("Uncut (exists: false):", uncut1);
    console.log("Uncut (dispersionId: null):", uncut2);
    
    // Also check what paymentMethod they use
    const stripeOrders = await Order.countDocuments({ paymentMethod: 'stripe' });
    console.log("Stripe orders:", stripeOrders);

    process.exit(0);
}
test();
