const nodemailer = require('nodemailer');

const Order = require('../models/Order');
const Visit = require('../models/Visit');
const Product = require('../models/Product');
const Business = require('../models/Business');
const mongoose = require('mongoose');
const tzHelper = require('../helper/timezone');

// 1. Registrar Visita (Público)
exports.registerVisit = async (req, res) => {
    try {
        const { slug, visitorId } = req.body;
        
        let decodedSlug = slug;
        try { decodedSlug = decodeURIComponent(slug); } catch (e) {}
        const possibleSlugs = [slug, decodedSlug, decodedSlug.replace(/’/g, "'"), decodedSlug.replace(/'/g, "’")];

        const business = await Business.findOne({ slug: { $in: possibleSlugs } });
        if(!business) return res.status(404).json({error: 'Negocio no encontrado'});

        // Evitar duplicados el mismo día para el mismo usuario
        const startOfDay = tzHelper.getStartOfDay();

        const exists = await Visit.findOne({
            businessId: business._id,
            visitorId: visitorId,
            date: { $gte: startOfDay }
        });

        if (!exists) {
            await Visit.create({
                businessId: business._id,
                visitorId: visitorId,
                userAgent: req.headers['user-agent']
            });
        }
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. Registrar Pedido / Clic WhatsApp (Público)
exports.registerOrder = async (req, res) => {
    try {
        const { slug, customerName, customerPhone, customerId, cart, total, subtotal, commission, deliveryCost, deliveryZone, customerStreet, customerColony, customerNumber, customerZipCode, customerReference, customerHowToPay, paymentMethod, stripePaymentIntentId, paymentFee } = req.body;
        
        let decodedSlug = slug;
        try { decodedSlug = decodeURIComponent(slug); } catch (e) {}
        const possibleSlugs = [slug, decodedSlug, decodedSlug.replace(/’/g, "'"), decodedSlug.replace(/'/g, "’")];

        const business = await Business.findOne({ slug: { $in: possibleSlugs } });
        if (!business) return res.status(404).json({ error: 'Negocio no encontrado' });
        
        // Guardar Orden
        const newOrder = new Order({
            businessId: business._id,
            customerName,
            customerPhone,
            customerStreet,
            customerColony,
            customerNumber,
            customerZipCode,
            customerReference,
            customerHowToPay,
            customerId,
            paymentMethod: paymentMethod || 'cash',
            stripePaymentIntentId,
            stripePaymentStatus: paymentMethod === 'stripe' ? 'succeeded' : undefined,
            items: cart.map(item => ({
                productId: item.product._id,
                name: item.product.name,
                quantity: item.quantity,
                price: item.product.price
            })),
            total,
            subtotal,
            deliveryCost: deliveryCost || 0,
            deliveryZone: deliveryZone || '',
            paymentFee: paymentFee || 0,
            commission: commission ? {
                type: commission.type,
                amount: commission.amount,
                origin: commission.origin
            } : undefined
        });
        await newOrder.save();

        // Incrementar contador de "Más Vendidos" en Productos
        // Esto optimiza la lectura de estadísticas después
        for (const item of cart) {
            await Product.findByIdAndUpdate(item.product._id, { 
                $inc: { salesCount: item.quantity } 
            });
        }

        // 4. Actualizar Inventario (Stock)
        for (const item of cart) {
            const product = await Product.findById(item.product._id);
            
            // Solo actualizamos si el producto tiene control de stock (stock > 0)
            if (product && product.stock !== null && product.stock !== undefined) {
                
                // Validamos si el producto tiene variantes
                if (item.selectedOptions && item.selectedOptions.length > 0) {
                    // Lógica de Variantes
                    for (const option of item.selectedOptions) {
                        const variant = product.variants.find(v => v.name === option.name);
                        if (variant) {
                            variant.stock -= item.quantity;
                        }
                    }
                } else {
                    // Lógica de Producto Simple
                    product.stock -= item.quantity;
                }
                
                await product.save();
            }
        }


        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. Obtener KPI Dashboard (Privado - Para el Panel)
exports.getDashboardStats = async (req, res) => {
    try {
        const businessId = req.user.businessId;
        const today = tzHelper.getStartOfDay();

        // 1. KPIs Básicos
        const ordersToday = await Order.find({ businessId, createdAt: { $gte: today } });
        const salesToday = ordersToday.reduce((sum, order) => sum + order.total, 0);
        const totalOrders = await Order.countDocuments({ businessId });
        const uniqueUsers = await Order.distinct('customerPhone', { businessId });
        const visitsToday = await Visit.countDocuments({ businessId, date: { $gte: today } });

        // 2. Gráfica de Ventas (Últimos 7 días)
        const last7DaysDate = new Date();
        last7DaysDate.setDate(last7DaysDate.getDate() - 6);
        const last7Days = tzHelper.getStartOfDay(last7DaysDate);

        // --- ZONA HORARIA ---
        const TIMEZONE_OFFSET = "-06:00"; 

        // Agregación para sumar ventas por día
        const salesAgg = await Order.aggregate([
            { $match: { 
                businessId: new mongoose.Types.ObjectId(businessId), 
                createdAt: { $gte: last7Days } 
            }},
            { $group: {
                // Aquí aplicamos la zona horaria para que agrupe correctamente por día LOCAL
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TIMEZONE_OFFSET } },
                total: { $sum: "$total" }
            }},
            { $sort: { _id: 1 } }
        ]);

        // Rellenar días vacíos
        const chartData = [];
        const chartLabels = [];
        
        for (let i = 0; i < 7; i++) {
            const d = new Date(last7Days);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            
            // Formato etiqueta: "Lun", "Mar"
            const dayLabel = d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'UTC' }); 
            
            // Buscamos coincidencia
            const found = salesAgg.find(s => s._id === dateStr);
            chartData.push(found ? found.total : 0);
            chartLabels.push(dayLabel);
        }

        // 3. Top 5 Productos
        const topProducts = await Product.find({ businessId })
            .sort({ salesCount: -1 })
            .limit(5)
            .select('name image salesCount price');

        res.json({
            salesToday,
            ordersTodayCount: ordersToday.length,
            totalOrders,
            uniqueUsers: uniqueUsers.length,
            visitsToday,
            chart: { labels: chartLabels, data: chartData },
            topProducts
        });

    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. Registrar Venta POS
exports.createPosOrder = async (req, res) => {
    try {
        const { cart, customer, discount, commission, paymentMethod, totals } = req.body;
        
        const newOrder = new Order({
            businessId: req.user.businessId,
            customerName: customer ? customer.name : 'Cliente Mostrador',
            customerId: customer ? customer._id : null,
            items: cart.map(item => ({
                productId: item._id,
                name: item.name,
                quantity: item.qty,
                price: item.price,
                selectedOptions: item.selectedOptions,
                note: item.note
            })),
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            discount: discount,
            commission: {
                type: commission.type,
                amount: commission.amount,
                origin: commission.origin
            },
            source: 'pos',
            status: 'pending', // del POS pasa al KDS
            paymentMethod: paymentMethod
        });

        await newOrder.save();

        // Actualizar stock o ventas del producto
        for (const item of cart) {
            await Product.findByIdAndUpdate(item._id, { $inc: { salesCount: item.qty } });
        }

        // 4. Actualizar Inventario (Stock)
        for (const item of cart) {
            const product = await Product.findById(item._id);
            
            // Solo actualizamos si el producto tiene control de stock (stock > 0)
            if (product && product.stock !== null && product.stock !== undefined) {
                
                // Validamos si el producto tiene variantes
                if (item.selectedOptions && item.selectedOptions.length > 0) {
                    // Lógica de Variantes
                    for (const option of item.selectedOptions) {
                        const variant = product.variants.find(v => v.name === option.name);
                        if (variant) {
                            variant.stock -= item.qty;
                        }
                    }
                } else {
                    // Lógica de Producto Simple
                    product.stock -= item.qty;
                }
                
                await product.save();
            }
        }

        // Si hay cliente de lealtad, sumar puntos
        if (customer && customer._id) {
            // Aquí podrías llamar a la lógica de loyaltyController o duplicarla simplificada
            const CustomerModel = require('../models/Customer');
            const LoyaltyProgram = require('../models/LoyaltyProgram');
            const program = await LoyaltyProgram.findOne({ businessId: req.user.businessId });
            
            if (program && program.active) {
                const pointsToAdd = program.type === 'points' ? Math.floor(totals.total) : 1;
                await CustomerModel.findByIdAndUpdate(customer._id, {
                    $inc: { points: pointsToAdd, visits: 1 },
                    lastVisit: new Date()
                });
            }
        }

        res.json({ success: true, orderId: newOrder._id });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
};

// 4. Enviar notificaciones por Email
exports.sendNotificationEmail = async (req, res) => {
    try {
        const { msg, orderDetails, business } = req.body;
        const order = orderDetails; // Renombramos para claridad

        // Configuración del transporter (Ejemplo con un servicio como SendGrid, Resend, etc.)
        const transporter = nodemailer.createTransport({
            host: 'smtp.resend.com', // El servidor de la "oficina de correos"
            port: 465,               // Puerto seguro
            secure: true,            // Usa encriptación SSL/TLS
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        const subject = `Nuevo Pedido Online - ${business.appName}`;
        // Construimos el contenido HTML para enviar al usuario que acaba de realizar el pedido
        const htmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="background: ${business.color || '#000000'}; color: #fff; padding: 20px; text-align: center; margin: 0;">
                    🔔 Gracias por tu pedido, ${order.customerName}
                </h2>
                <div style="padding: 20px; border: 1px solid #eee;">
                    <p style="color: #666; margin-top: 0;">
                        <strong>Teléfono:</strong> ${order.customerPhone} | 
                        <strong>Email:</strong> ${order.customerEmail || 'N/A'}
                    </p>
                    <p style="color: #666; margin-top: 0;">
                        <strong>Entrega:</strong> ${order.deliveryType === 'pickup' ? 'Recolección' : 'En Domicilio'} (${order.deliveryZone || 'N/A'})
                    </p>
                    
                    <h3 style="margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 5px;">
                        Detalle de tu pedido
                    </h3>
                    <ul style="list-style: none; padding: 0;">
                        ${
                            order.cart.map(i => {
                                let itemHtml = `<li style="margin-bottom: 8px;">
                                    <strong>▪️ ${i.quantity}x ${i.product.name}</strong> ($${(i.unitPrice * i.quantity).toFixed(2)})`;
                                if (i.selectedOptions && i.selectedOptions.length > 0) {
                                    const extras = i.selectedOptions.map(o => o.name).join(', ');
                                    itemHtml += `<br><span style="color: #666; font-size: 13px; padding-left: 20px; display: inline-block;">
                                        <em>Extras: ${extras}</em>
                                    </span>`;
                                }
                                itemHtml += `</li>`;
                                return itemHtml;
                            }).join('')
                        }
                    </ul>
                    
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; text-align: right;">
                        <p style="margin: 5px 0;">Subtotal: $${order.subtotal.toFixed(2)}</p>
                        <p style="margin: 5px 0;">Envío: $${order.deliveryCost.toFixed(2)}</p>
                        <p style="margin: 5px 0; font-weight: bold; color: ${business.color || '#000000'}; font-size: 20px;">
                            Total: $${order.total.toFixed(2)}
                        </p>
                        ${order.paymentMethod ? `<p style="font-size: 12px; color: #999;">Método de pago: ${order.paymentMethod}</p>` : ''}
                    </div>

                    <div style="margin-top: 30px; text-align: center; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                        <a href="https://wa.me/${business.phone}?text=${encodeURIComponent(msg)}" style="background: ${business.color || '#000000'}; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                           Enviar nuevamente por Whatsapp
                        </a>
                    </div>
                </div>
            </div>
        `;

        await transporter.sendMail({ 
            from: '"Sistema de Pedidos" <pedidos@tengo-hambre.com>',
            to: order.customerEmail, 
            subject: subject, 
            html: htmlContent 
        });
        res.json({ success: true });
    } catch (error) {
        console.error("Error enviando email de notificación:", error);
        res.status(500).json({ error: error.message });
    }
};


