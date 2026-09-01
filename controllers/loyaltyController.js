const LoyaltyProgram = require('../models/LoyaltyProgram');
const Customer = require('../models/Customer');
const Business = require('../models/Business');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const SECRET_KEY = process.env.JWT_SECRET || 'jwt_secret_key_default';

// Helper to send email OTP via Resend / Nodemailer
const sendOtpEmail = async (email, name, otpCode) => {
    const transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    const senderEmail = process.env.SMTP_FROM || 'notificaciones@tengo-hambre.com';

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .card { background-color: #1e293b; max-width: 480px; margin: 0 auto; border-radius: 20px; padding: 32px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
        .logo { text-align: center; margin-bottom: 24px; }
        .title { font-size: 22px; font-weight: 800; color: #ffffff; text-align: center; margin-bottom: 8px; }
        .subtitle { font-size: 14px; color: #94a3b8; text-align: center; margin-bottom: 28px; line-height: 1.5; }
        .otp-box { background: linear-gradient(135deg, #E30613, #C20510); border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 28px; }
        .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff; margin: 0; font-family: monospace; }
        .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 24px; border-top: 1px solid #334155; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">
          <h2 style="color: #E30613; font-size: 26px; margin: 0; font-weight: 900;">Tengo Hambre <span style="color: #ffffff;">Inc</span></h2>
        </div>
        <div class="title">Código de Verificación</div>
        <div class="subtitle">Hola ${name || 'Usuario'}, ingresa el siguiente código en la aplicación para restablecer tu contraseña. Este código expira en 15 minutos.</div>
        <div class="otp-box">
          <div class="otp-code">${otpCode}</div>
        </div>
        <div class="footer">
          Si no solicitaste este cambio, puedes ignorar este correo de forma segura.<br>
          © Tengo Hambre Inc. Todos los derechos reservados.
        </div>
      </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
        from: `"Tengo Hambre Inc" <${senderEmail}>`,
        to: email,
        subject: `Código de verificación: ${otpCode} - Tengo Hambre Inc`,
        html: htmlContent
    });
};

exports.requestPasswordReset = async (req, res) => {
    try {
        const { identifier } = req.body;
        if (!identifier || !identifier.trim()) {
            return res.status(400).json({ message: 'Ingresa tu teléfono o correo electrónico.' });
        }

        const input = identifier.trim().toLowerCase();
        
        // Buscar cliente por correo o por teléfono
        const customer = await Customer.findOne({
            $or: [{ email: input }, { phone: input }]
        });

        if (!customer) {
            // Por seguridad, responder éxito genérico sin revelar ausencia de cuenta
            return res.json({
                success: true,
                message: 'Si tu cuenta se encuentra registrada, recibirás el código de verificación por correo electrónico.'
            });
        }

        if (!customer.email) {
            return res.status(400).json({ message: 'Esta cuenta no tiene un correo electrónico asociado para enviar el código.' });
        }

        // Generar código OTP de 6 dígitos
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        customer.resetOtp = otpCode;
        customer.resetOtpExpires = expiresAt;
        await customer.save();

        // Enviar correo por SMTP Resend
        await sendOtpEmail(customer.email, customer.name, otpCode);

        // Enmascarar correo para vista previa
        const parts = customer.email.split('@');
        const maskedEmail = parts[0].substring(0, 2) + '***@' + parts[1];

        res.json({
            success: true,
            emailSent: true,
            maskedEmail,
            message: `Enviamos un código de 6 dígitos al correo ${maskedEmail}. Revisa tu bandeja de entrada.`
        });
    } catch (e) {
        console.error('Error en requestPasswordReset:', e);
        res.status(500).json({ message: 'Error al enviar el código por correo: ' + e.message });
    }
};

exports.verifyPasswordReset = async (req, res) => {
    try {
        const { identifier, otp, newPassword } = req.body;

        if (!identifier || !otp || !newPassword) {
            return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
        }

        if (newPassword.trim().length < 4) {
            return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 4 caracteres.' });
        }

        const input = identifier.trim().toLowerCase();
        const customer = await Customer.findOne({
            $or: [{ email: input }, { phone: input }]
        });

        if (!customer || !customer.resetOtp || !customer.resetOtpExpires) {
            return res.status(400).json({ message: 'No se encontró una solicitud de restablecimiento activa para esta cuenta.' });
        }

        // Verificar expiración
        if (new Date() > new Date(customer.resetOtpExpires)) {
            return res.status(400).json({ message: 'El código de verificación ha expirado. Solicita uno nuevo.' });
        }

        // Verificar coincidencia de OTP
        if (customer.resetOtp.trim() !== otp.trim()) {
            return res.status(401).json({ message: 'El código de verificación de 6 dígitos es incorrecto.' });
        }

        // Encriptar nueva contraseña y limpiar OTP
        customer.password = await bcrypt.hash(newPassword.trim(), 10);
        customer.resetOtp = undefined;
        customer.resetOtpExpires = undefined;
        customer.pin = undefined;
        await customer.save();

        res.json({
            success: true,
            message: 'Tu contraseña ha sido actualizada con éxito. Ya puedes iniciar sesión.'
        });
    } catch (e) {
        console.error('Error en verifyPasswordReset:', e);
        res.status(500).json({ message: 'Error al actualizar la contraseña: ' + e.message });
    }
};

// --- PÚBLICO (WebApp) ---

exports.getCustomerStatus = async (req, res) => {
    try {
        const { slug, phone, email, identifier, pin, password } = req.body; 
        const inputPassword = password || pin; // Retrocompatibilidad con nombres antiguos
        const loginInput = (phone || email || identifier || '').trim().toLowerCase();
        
        let decodedSlug = slug;
        try { decodedSlug = decodeURIComponent(slug); } catch (e) {}
        
        let business = null;
        let program = null;
        
        if (slug) {
            const possibleSlugs = [slug, decodedSlug, decodedSlug.replace(/’/g, "'"), decodedSlug.replace(/'/g, "’")];
            business = await Business.findOne({ slug: { $in: possibleSlugs } });
            if (business) {
                program = await LoyaltyProgram.findOne({ businessId: business._id });
            }
        }

        // Búsqueda unificada por teléfono o por correo electrónico
        const customer = await Customer.findOne({
            $or: [{ phone: loginInput }, { email: loginInput }]
        });
        
        // Escenario 1: Cliente no existe
        if (!customer) {
            if (inputPassword) {
                return res.status(404).json({ registered: false, message: 'Usuario no encontrado. Por favor verifica tus datos o regístrate.' });
            }
            return res.json({ registered: false, program });
        }

        // Escenario 2: Cliente existe, pero no enviaron contraseña (Intento de consulta rápida)
        if (!inputPassword) {
            return res.json({ 
                registered: true, 
                active: program ? (program.active ? true : false) : false, 
                authRequired: true, 
                program
            });
        }

        // Escenario 3: Cliente existe y enviaron contraseña (Validación)
        // Soporte tanto para bcrypt como para PINs anteriores en texto plano (migración automática asistida)
        let isMatch = false;
        if (customer.password) {
            isMatch = await bcrypt.compare(inputPassword, customer.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Contraseña incorrecta' });
            }
        } else if (customer.pin) {
            isMatch = (customer.pin === inputPassword);
            if (!isMatch) {
                return res.status(401).json({ message: 'Contraseña incorrecta' });
            }
            // Si el pin coincide pero no tiene contraseña encriptada, solicitar la configuración
            return res.json({
                registered: true,
                requirePasswordSetup: true,
                phone: customer.phone,
                pin: inputPassword,
                email: customer.email || '',
                message: 'Actualización de seguridad requerida: configura tu contraseña.'
            });
        } else {
            // Caso raro de usuario sin PIN ni Password en la BD
            return res.json({
                registered: true,
                requirePasswordSetup: true,
                phone: customer.phone,
                email: customer.email || '',
                message: 'Actualización de seguridad requerida: configura tu contraseña.'
            });
        }

        // Generar Token JWT
        const token = jwt.sign(
            { id: customer._id, phone: customer.phone, email: customer.email, name: customer.name },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        // Login Exitoso
        res.json({ 
            registered: true, 
            active: program ? (program.active ? true : false) : false, 
            authSuccess: true,
            token,
            customer: {
                _id: customer._id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                avatar: customer.avatar || '',
                points: customer.points
            }, 
            program 
        });

    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.setupPassword = async (req, res) => {
    try {
        const { phone, pin, password, email } = req.body;
        if (!phone || !password || password.trim().length < 4) {
            return res.status(400).json({ message: 'Datos incompletos o contraseña inválida (mínimo 4 caracteres).' });
        }

        const customer = await Customer.findOne({ phone });
        if (!customer) {
            return res.status(404).json({ message: 'Cliente no encontrado.' });
        }

        // Si ya tiene contraseña, no permitir reconfiguración por este método abierto
        if (customer.password) {
            return res.status(400).json({ message: 'Esta cuenta ya tiene una contraseña configurada.' });
        }

        // Validar que el PIN legacy coincida si existe en la base de datos
        if (customer.pin && customer.pin !== pin) {
            return res.status(401).json({ message: 'El PIN de verificación es incorrecto.' });
        }

        // Si se envió un correo, validamos y guardamos
        if (email && email.trim()) {
            const trimmedEmail = email.toLowerCase().trim();
            // Verificar si el correo ya existe en otro cliente
            const existingEmail = await Customer.findOne({ email: trimmedEmail, _id: { $ne: customer._id } });
            if (existingEmail) {
                return res.status(400).json({ message: 'El correo electrónico ya está registrado por otro usuario.' });
            }
            customer.email = trimmedEmail;
        } else if (!customer.email) {
            // Si la cuenta no tenía correo y no se envió ninguno
            return res.status(400).json({ message: 'El correo electrónico es obligatorio para actualizar tu cuenta.' });
        }

        // Cifrar nueva contraseña y guardar
        customer.password = await bcrypt.hash(password, 10);
        customer.pin = undefined; // Limpiar PIN obsoleto
        await customer.save();

        // Generar Token JWT
        const token = jwt.sign(
            { id: customer._id, phone: customer.phone, email: customer.email, name: customer.name },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            customer: {
                _id: customer._id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                avatar: customer.avatar || '',
                points: customer.points
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

exports.registerCustomer = async (req, res) => {
    try {
        const { slug, name, phone, pin, password, email } = req.body;
        const inputPassword = password || pin;
        
        if (!email || !email.trim()) {
            return res.status(400).json({ message: 'El correo electrónico es obligatorio' });
        }

        if (!inputPassword || inputPassword.length < 4) {
            return res.status(400).json({ message: 'La contraseña debe tener al menos 4 caracteres' });
        }

        // Verificar si ya existe un cliente con ese email o teléfono
        const existingCustomer = await Customer.findOne({ $or: [{ phone }, { email: email.toLowerCase() }] });
        if (existingCustomer) {
            return res.status(400).json({ message: 'El teléfono o correo ya se encuentra registrado' });
        }

        let businessId = null;
        if (slug) {
            let decodedSlug = slug;
            try { decodedSlug = decodeURIComponent(slug); } catch (e) {}
            const possibleSlugs = [slug, decodedSlug, decodedSlug.replace(/’/g, "'"), decodedSlug.replace(/'/g, "’")];
            const business = await Business.findOne({ slug: { $in: possibleSlugs } });
            if (business) businessId = business._id;
        }

        // Encriptar password
        const hashedPassword = await bcrypt.hash(inputPassword, 10);
        
        const newCustomer = new Customer({
            businessId,
            name,
            phone,
            email: email.toLowerCase(),
            password: hashedPassword
        });
        
        await newCustomer.save();

        // Generar Token JWT
        const token = jwt.sign(
            { id: newCustomer._id, phone: newCustomer.phone, email: newCustomer.email, name: newCustomer.name },
            SECRET_KEY,
            { expiresIn: '7d' }
        );

        res.json({ 
            success: true, 
            token,
            customer: {
                _id: newCustomer._id,
                name: newCustomer.name,
                phone: newCustomer.phone,
                email: newCustomer.email,
                avatar: '',
                points: 0
            } 
        });
    } catch (e) { 
        res.status(400).json({ error: 'Error al registrar el cliente: ' + e.message }); 
    }
};

exports.getProgramConfig = async (req, res) => {  
    try {
        let program = await LoyaltyProgram.findOne({ businessId: req.user.businessId });
        if (!program) { program = new LoyaltyProgram({ businessId: req.user.businessId }); await program.save(); }
        res.json(program);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.updateProgramConfig = async (req, res) => { 
    try {
        const program = await LoyaltyProgram.findOneAndUpdate({ businessId: req.user.businessId }, req.body, { returnDocument: 'after', upsert: true });
        res.json(program);
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.addPoints = async (req, res) => { 
    try {
        const { phone, amount } = req.body;
        const customer = await Customer.findOne({ businessId: req.user.businessId, phone });
        if (!customer) return res.status(404).json({ message: 'Cliente no encontrado' });
        const program = await LoyaltyProgram.findOne({ businessId: req.user.businessId });
        if (program.type === 'points') customer.points += parseInt(amount); else customer.points += 1;
        customer.visits += 1; customer.lastVisit = new Date();
        await customer.save();
        const goalReached = customer.points >= program.goal;
        res.json({ success: true, newBalance: customer.points, goalReached, reward: program.reward });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.redeemReward = async (req, res) => { 
    try {
        const { phone } = req.body;
        const customer = await Customer.findOne({ businessId: req.user.businessId, phone });
        const program = await LoyaltyProgram.findOne({ businessId: req.user.businessId });
        if (customer.points < program.goal) return res.status(400).json({ message: 'Puntos insuficientes' });
        customer.points -= program.goal;
        await customer.save();
        res.json({ success: true, message: 'Premio canjeado', newBalance: customer.points });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

exports.searchCustomers = async (req, res) => {
    try {
        const { q } = req.query; // q = término de búsqueda
        const businessId = req.user.businessId;
        
        let query = { businessId };
        
        if (q) {
            // Buscar por Nombre O Teléfono
            query.$or = [
                { name: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ];
        }

        // Traer los últimos 5 si no hay búsqueda, o los coincidentes
        const customers = await Customer.find(query)
            .sort({ lastVisit: -1 }) // Los más recientes primero
            .limit(10);
            
        res.json(customers);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
