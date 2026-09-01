const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

try {
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("Firebase Admin initialized successfully");
  } else {
    console.warn("Firebase service account JSON not found. Push notifications will not work.");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
}

module.exports = admin;
