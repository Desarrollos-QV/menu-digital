const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    appName: { type: String, default: 'FoodAdmin' },
    adminName: { type: String, default: 'Administrador' }
});

module.exports = mongoose.model('Config', configSchema);