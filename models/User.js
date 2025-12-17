const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true, sparse: true, trim: true, lowercase: true }, 
    // CAMBIOS SAAS:
    role: { type: String, enum: ['superadmin', 'admin_negocio'], default: 'admin_negocio' },
    businessId: { type: mongoose.Schema.Types.ObjectId, ref: 'Business' }, // Null si es superadmin

    createdAt: { type: Date, default: Date.now }
});

// Middleware: Encriptar contraseña antes de guardar
// CORRECCIÓN: Eliminamos 'next'. Con async, Mongoose espera a que termine la promesa.
userSchema.pre('save', async function() {
    // Si la contraseña no se modificó, simplemente salimos (return)
    if (!this.isModified('password')) return;
    
    // Encriptamos
    this.password = await bcrypt.hash(this.password, 10);
});

// Método para comparar contraseñas al hacer login
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);