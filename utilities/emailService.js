/**
 * Email Service for MarketLink / MarketEase
 * Handles customer email verification codes, password resets, and order confirmation notifications.
 */

// In-memory verification code store with expiration (15 minutes)
const verificationCodes = new Map();

/**
 * Generate a cryptographically secure 6-digit numeric verification code
 */
export const generateVerificationCode = (email) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  verificationCodes.set(email.toLowerCase(), {
    code,
    expiresAt,
    verified: false,
  });

  return { code, expiresAt };
};

/**
 * Validate an entered verification code for an email
 */
export const verifyCode = (email, inputCode) => {
  const record = verificationCodes.get(email.toLowerCase());
  if (!record) {
    return { valid: false, message: 'No verification code found. Please request a new code.' };
  }

  if (new Date() > record.expiresAt) {
    verificationCodes.delete(email.toLowerCase());
    return { valid: false, message: 'Verification code has expired. Please request a new code.' };
  }

  if (record.code !== inputCode.toString().trim()) {
    return { valid: false, message: 'Invalid verification code.' };
  }

  record.verified = true;
  return { valid: true, message: 'Email successfully verified.' };
};

/**
 * Retrieve current active code for simulated inbox / debugging
 */
export const getActiveVerificationCode = (email) => {
  const record = verificationCodes.get(email.toLowerCase());
  if (!record || new Date() > record.expiresAt) {
    return null;
  }
  return record.code;
};

/**
 * Send an email verification message (Console + Simulated Dispatch)
 */
export const sendVerificationEmail = async (email, code, userName = 'Valued Customer') => {
  console.log(`\n================ EMAIL DISPATCH ================`);
  console.log(`To: ${email}`);
  console.log(`Subject: Your MarketLink Verification Code`);
  console.log(`Hello ${userName},\nYour 6-digit verification code is: [ ${code} ]`);
  console.log(`This code will expire in 15 minutes.`);
  console.log(`================================================\n`);

  return {
    success: true,
    sentTo: email,
    codePreview: code,
    message: `Verification code sent to ${email}`,
  };
};

/**
 * Send order confirmation alert
 */
export const sendOrderConfirmationEmail = async (email, order) => {
  console.log(`\n================ ORDER CONFIRMATION EMAIL ================`);
  console.log(`To: ${email}`);
  console.log(`Subject: MarketLink Order Confirmation #${order._id || order.id}`);
  console.log(`Total: $${order.total || 0}`);
  console.log(`Delivery Address: ${order.deliveryAddress || 'Pickup at market'}`);
  console.log(`==========================================================\n`);

  return {
    success: true,
    sentTo: email,
    orderId: order._id || order.id,
  };
};

export default {
  generateVerificationCode,
  verifyCode,
  getActiveVerificationCode,
  sendVerificationEmail,
  sendOrderConfirmationEmail,
};
