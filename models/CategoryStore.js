const mongoose = require('mongoose');

const CategoryStoreSchema = new mongoose.Schema({
    name: { type: String, required: true },
    emoji: { type: String, required: true },
    active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('CategoryStore', CategoryStoreSchema);
