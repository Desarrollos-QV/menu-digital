const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');

exports.getConfig = (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        stripeEnabled: !!process.env.STRIPE_PUBLISHABLE_KEY,
        feePercent: parseFloat(process.env.STRIPE_FEE_PERCENT) || 0,
        feeFixed: parseFloat(process.env.STRIPE_FEE_FIXED) || 0
    });
};

exports.createPaymentIntent = async (req, res) => {
    try {
        const { amount, currency } = req.body;
        
        // El amount viene en formato decimal (ej: 100.50). Stripe requiere centavos (10050)
        const amountInCents = Math.round(amount * 100);

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: currency || 'MXN',
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        });
    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ error: error.message });
    }
};

exports.handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
        case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            console.log(`PaymentIntent ${paymentIntent.id} succeeded`);
            
            try {
                const order = await Order.findOneAndUpdate(
                    { stripePaymentIntentId: paymentIntent.id },
                    { 
                        stripePaymentStatus: 'succeeded',
                        status: 'preparing'
                    },
                    { new: true }
                );
                if(order) console.log(`Order ${order._id} updated via Stripe webhook.`);
            } catch (err) {
                console.error("Error updating order on webhook:", err);
            }
            break;
        case 'payment_intent.payment_failed':
            const paymentFailed = event.data.object;
            console.log(`PaymentIntent ${paymentFailed.id} failed`);
            try {
                await Order.findOneAndUpdate(
                    { stripePaymentIntentId: paymentFailed.id },
                    { stripePaymentStatus: 'failed' }
                );
            } catch (err) {
                console.error("Error updating order on webhook:", err);
            }
            break;
        default:
            console.log(`Unhandled event type ${event.type}`);
    }

    res.send();
};
