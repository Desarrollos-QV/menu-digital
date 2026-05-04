// helper/timezone.js

const TIMEZONE = "America/Monterrey";

/**
 * Returns a UTC Date object representing the start of the current day in Monterrey time.
 * Or the start of a specific date if provided.
 */
exports.getStartOfDay = (date = new Date()) => {
    // Si date es un string tipo '2026-05-04', hay que tratarlo para que no se desfase
    const dateObj = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : new Date(date);
    const mtyDateStr = dateObj.toLocaleString("en-US", { timeZone: TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric' });
    const [month, day, year] = mtyDateStr.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00.000-06:00`);
};

/**
 * Returns a UTC Date object representing the end of the current day in Monterrey time.
 * Or the end of a specific date if provided.
 */
exports.getEndOfDay = (date = new Date()) => {
    const dateObj = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : new Date(date);
    const mtyDateStr = dateObj.toLocaleString("en-US", { timeZone: TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric' });
    const [month, day, year] = mtyDateStr.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59.999-06:00`);
};

/**
 * Ajusta una fecha dada al inicio del mes en Monterrey
 */
exports.getStartOfMonth = (date = new Date()) => {
    const dateObj = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : new Date(date);
    const mtyDateStr = dateObj.toLocaleString("en-US", { timeZone: TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric' });
    const [month, , year] = mtyDateStr.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00.000-06:00`);
};

/**
 * Ajusta una fecha dada al final del mes en Monterrey
 */
exports.getEndOfMonth = (date = new Date()) => {
    const start = exports.getStartOfMonth(date);
    // Para obtener el último día, avanzamos al siguiente mes y restamos 1 ms
    const nextMonth = new Date(start);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    return new Date(nextMonth.getTime() - 1);
};

/**
 * Ajusta una fecha dada al inicio del año en Monterrey
 */
exports.getStartOfYear = (date = new Date()) => {
    const dateObj = typeof date === 'string' ? new Date(date + 'T12:00:00Z') : new Date(date);
    const mtyDateStr = dateObj.toLocaleString("en-US", { timeZone: TIMEZONE, year: 'numeric', month: 'numeric', day: 'numeric' });
    const [, , year] = mtyDateStr.split('/');
    return new Date(`${year}-01-01T00:00:00.000-06:00`);
};
