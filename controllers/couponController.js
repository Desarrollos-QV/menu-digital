const Coupon = require('../models/Coupon');

// --- RUTAS ADMINISTRATIVAS ---

exports.getCoupons = async (req, res) => {
    try {
        let filter = {};
        if (req.user.role !== 'superadmin') {
            // Si es dueño, solo ve sus cupones (si habilitamos esto después)
            filter.businessId = req.user.businessId;
        }

        const coupons = await Coupon.find(filter).sort({ createdAt: -1 });
        res.json(coupons);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.createCoupon = async (req, res) => {
    try {
        const { code, discountType, discountValue, isActive, expirationDate, maxUses, minPurchaseAmount, businessId } = req.body;
        
        // El superadmin puede crearlo global (businessId = null)
        const newCoupon = new Coupon({
            code: code.trim().toUpperCase(),
            discountType,
            discountValue,
            isActive: isActive !== undefined ? isActive : true,
            expirationDate: expirationDate ? new Date(expirationDate) : null,
            maxUses: maxUses || 0,
            minPurchaseAmount: minPurchaseAmount || 0,
            businessId: req.user.role === 'superadmin' ? (businessId || null) : req.user.businessId
        });

        await newCoupon.save();
        res.status(201).json(newCoupon);
    } catch (e) {
        if (e.code === 11000) return res.status(400).json({ message: 'El código de cupón ya existe.' });
        res.status(500).json({ error: e.message });
    }
};

exports.updateCoupon = async (req, res) => {
    try {
        const { isActive, expirationDate, maxUses } = req.body;
        const coupon = await Coupon.findById(req.params.id);
        
        if (!coupon) return res.status(404).json({ message: 'Cupón no encontrado' });

        if (req.user.role !== 'superadmin' && String(coupon.businessId) !== String(req.user.businessId)) {
            return res.status(403).json({ message: 'No autorizado' });
        }

        if (isActive !== undefined) coupon.isActive = isActive;
        if (expirationDate !== undefined) coupon.expirationDate = expirationDate ? new Date(expirationDate) : null;
        if (maxUses !== undefined) coupon.maxUses = maxUses;

        await coupon.save();
        res.json(coupon);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.deleteCoupon = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) return res.status(404).json({ message: 'Cupón no encontrado' });

        if (req.user.role !== 'superadmin' && String(coupon.businessId) !== String(req.user.businessId)) {
            return res.status(403).json({ message: 'No autorizado' });
        }

        await Coupon.findByIdAndDelete(req.params.id);
        res.json({ message: 'Cupón eliminado' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// --- RUTA PÚBLICA DE VALIDACIÓN (CARRITO) ---

exports.validateCoupon = async (req, res) => {
    try {
        const { code, businessId, subtotal } = req.body;
        const customerId = req.customer.id; // Viene del middleware de autenticación

        if (!customerId) {
            return res.status(401).json({ message: 'Debes iniciar sesión para usar un cupón.' });
        }

        const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
        if (!coupon) {
            return res.status(404).json({ message: 'Cupón inválido o no existe.' });
        }

        if (!coupon.isActive) {
            return res.status(400).json({ message: 'El cupón está desactivado.' });
        }

        if (coupon.businessId && String(coupon.businessId) !== String(businessId)) {
            return res.status(400).json({ message: 'El cupón no es válido para este negocio.' });
        }

        if (coupon.expirationDate && new Date() > coupon.expirationDate) {
            return res.status(400).json({ message: 'El cupón ha expirado.' });
        }

        if (coupon.maxUses > 0 && coupon.currentUses >= coupon.maxUses) {
            return res.status(400).json({ message: 'El cupón ha alcanzado su límite de usos.' });
        }

        if (subtotal < coupon.minPurchaseAmount) {
            return res.status(400).json({ message: `El cupón requiere una compra mínima de $${coupon.minPurchaseAmount}.` });
        }

        // Revisar que el usuario no lo haya usado antes
        if (coupon.usedBy && coupon.usedBy.includes(customerId)) {
            return res.status(400).json({ message: 'Ya has utilizado este cupón anteriormente.' });
        }

        // Calcular descuento (Sobre el subtotal como pidió el cliente)
        let discountAmount = 0;
        if (coupon.discountType === 'fixed') {
            discountAmount = coupon.discountValue;
        } else if (coupon.discountType === 'percentage') {
            discountAmount = (subtotal * coupon.discountValue) / 100;
        }

        // Asegurar que el descuento no exceda el subtotal
        if (discountAmount > subtotal) {
            discountAmount = subtotal;
        }

        res.json({
            valid: true,
            couponId: coupon._id,
            code: coupon.code,
            discountAmount,
            discountType: coupon.discountType,
            message: 'Cupón aplicado con éxito.'
        });

    } catch (e) {
        console.error('Error validando cupón:', e);
        res.status(500).json({ error: 'Error interno validando el cupón.' });
    }
};
