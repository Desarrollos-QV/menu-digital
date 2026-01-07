const express = require('express');
const router = express.Router();
const QuoteController = require('../controllers/QuoteController');
const auth = require('../middleware/auth'); // Middleware de seguridad

router.get('/', auth, QuoteController.getQuotes);
router.post('/', auth, QuoteController.createQuote);
router.put('/:id', auth, QuoteController.updateQuote);
router.delete('/:id', auth, QuoteController.deleteQuote);

module.exports = router;