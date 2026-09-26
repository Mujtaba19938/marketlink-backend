import customerModel from '../model/customer.model.js';
import hashPassword from '../utilities/hashpassword.js';
import comparePassword from '../utilities/comppassword.js';
import jwt from 'jsonwebtoken';
import {
  generateVerificationCode,
  verifyCode,
  getActiveVerificationCode,
  sendVerificationEmail,
} from '../utilities/emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || "Abcd12345678!?";

/**
 * 1. Get all customers (Admin / Protected)
 */
const getAllcustomer = async (req, res) => {
  try {
    const customers = await customerModel.find().select('-pwd');
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * Legacy testing helper: generate hash for a password
 */
const getpwd = async (req, res) => {
  const pwd = req.params.pwd;
  const hashpwd = await hashPassword(pwd);
  res.status(200).json({
    success: true,
    msg: "your new pwd=" + hashpwd,
    hash: hashpwd,
  });
};

/**
 * Legacy testing helper: compare raw password with hash
 */
const getcomppwd = async (req, res) => {
  const pwd = req.params.pwd;
  const cpwd = req.params.cpwd;
  const result = await comparePassword(pwd, cpwd);
  res.status(200).json({
    success: true,
    msg: "compare pwd result =" + result,
    result,
  });
};

/**
 * 2. Authenticate Customer / User Login
 * Returns token and user payload matching frontend expectations
 */
const authlogin = async (req, res) => {
  try {
    const { email, pwd, password } = req.body;
    const loginPassword = pwd || password;

    if (!email || !loginPassword) {
      return res.status(400).json({
        success: false,
        msg: "Please provide both email and password",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const customer = await customerModel.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
    });

    if (!customer) {
      return res.status(200).json({
        success: false,
        msg: "email id does not exist please choose different",
        customers: [],
      });
    }

    const isMatch = await comparePassword(loginPassword, customer.pwd);

    if (!isMatch) {
      return res.status(200).json({
        success: false,
        msg: "Invalid password credentials",
        customers: [],
      });
    }

    const tokenData = {
      _id: customer._id,
      id: customer._id,
      customerNumber: customer.customerNumber,
      email: customer.email,
      name: customer.customerName || customer.name,
      role: customer.role || 'customer',
    };

    const token = jwt.sign(tokenData, JWT_SECRET, { expiresIn: '8h' });

    // Safe customer view (exclude password hash)
    const customerObj = customer.toObject();
    delete customerObj.pwd;

    return res.status(200).json({
      success: true,
      customers: [customerObj],
      customer: customerObj,
      user: {
        id: customer._id,
        name: customer.customerName || customer.name,
        email: customer.email,
        role: customer.role || 'customer',
        phone: customer.phone,
        address: customer.addressLine1 || customer.address,
        avatar: customer.avatar,
        badge: customer.badge,
        isEmailVerified: customer.isEmailVerified,
      },
      token: token,
      msg: "Login successful",
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({
      success: false,
      msg: "Server error during authentication: " + err.message,
    });
  }
};

/**
 * 3. Customer Registration with Email Verification Trigger
 */
const addcustomer = async (req, res) => {
  try {
    const { name, email, pwd, password, address, phone, contactNumber, role, area } = req.body;
    const customerPwd = pwd || password;
    const customerPhone = phone || contactNumber || "40.67.85552";
    const customerAddress = address || area || "Downtown";

    if (!name || !email || !customerPwd) {
      return res.status(400).json({
        success: false,
        msg: "Name, email, and password are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await customerModel.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
    });

    if (existing) {
      return res.status(200).json({
        success: false,
        msg: "email id already exist please choose different",
      });
    }

    const noofrec = await customerModel.countDocuments();
    const maxid = noofrec + 1;
    const hashpwd = await hashPassword(customerPwd);

    // Generate 6-digit email verification code
    const { code, expiresAt } = generateVerificationCode(normalizedEmail);

    const customerData = {
      customerNumber: maxid,
      customerName: name,
      name: name,
      contactLastName: name.split(' ').slice(1).join(' ') || name,
      contactFirstName: name.split(' ')[0] || name,
      phone: customerPhone,
      addressLine1: customerAddress,
      addressLine2: customerAddress,
      address: customerAddress,
      city: "karachi",
      state: null,
      postalCode: "440002",
      country: "France",
      salesRepEmployeeNumber: "1370",
      creditLimit: "118200",
      email: normalizedEmail,
      file: customerPwd,
      pwd: hashpwd,
      type: "M",
      role: role || 'customer',
      status: 'active',
      isEmailVerified: false,
      emailVerificationCode: code,
      emailVerificationExpires: expiresAt,
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
      badge: 'Registered Market Patron',
    };

    const newCustomer = new customerModel(customerData);
    await newCustomer.save();

    // Send verification email (logged to console & dispatch)
    await sendVerificationEmail(normalizedEmail, code, name);

    return res.status(200).json({
      success: true,
      msg: "Your registration has been completed with id=" + maxid,
      customerNumber: maxid,
      email: normalizedEmail,
      requiresVerification: true,
      verificationCodePreview: code, // Provided for smooth testing / simulated inbox
    });
  } catch (err) {
    console.error("Registration error:", err);
    return res.status(400).json({
      success: false,
      msg: "Your registration has not been completed due to " + err.message,
    });
  }
};

/**
 * 4. Verify Customer Email via 6-digit Code
 */
const verifyEmailCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        msg: "Email and verification code are required.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const verificationResult = verifyCode(normalizedEmail, code);

    if (!verificationResult.valid) {
      return res.status(400).json({
        success: false,
        msg: verificationResult.message,
      });
    }

    // Mark customer in database as email verified
    const updated = await customerModel.findOneAndUpdate(
      { email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } },
      {
        $set: {
          isEmailVerified: true,
          emailVerificationCode: null,
          emailVerificationExpires: null,
        },
      },
      { new: true }
    );

    return res.status(200).json({
      success: true,
      msg: "Email verified successfully! You may now proceed with checkout.",
      user: updated
        ? {
            id: updated._id,
            name: updated.customerName || updated.name,
            email: updated.email,
            isEmailVerified: true,
          }
        : null,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Failed to verify email: " + err.message,
    });
  }
};

/**
 * 5. Resend Verification Code
 */
const resendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, msg: "Email is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const customer = await customerModel.findOne({
      email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') },
    });

    const { code, expiresAt } = generateVerificationCode(normalizedEmail);

    if (customer) {
      customer.emailVerificationCode = code;
      customer.emailVerificationExpires = expiresAt;
      await customer.save();
    }

    await sendVerificationEmail(normalizedEmail, code, customer?.name || 'Customer');

    return res.status(200).json({
      success: true,
      msg: `Verification code resent to ${normalizedEmail}`,
      verificationCodePreview: code,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: "Could not resend verification code: " + err.message,
    });
  }
};

/**
 * 6. Get Active Verification Code (For Simulated Inbox & Testing)
 */
const getSimulatedVerificationCode = async (req, res) => {
  const email = req.params.email;
  const code = getActiveVerificationCode(email);
  if (!code) {
    return res.status(404).json({
      success: false,
      msg: "No active verification code found or code has expired.",
    });
  }
  return res.status(200).json({
    success: true,
    email,
    code,
  });
};

/**
 * 7. Update Customer Profile
 */
const updatecustomer = async (req, res) => {
  try {
    const { name, email, address, cno, phone, area } = req.body;
    const query = cno ? { customerNumber: cno } : { email: email };

    const updateData = {};
    if (name) {
      updateData.customerName = name;
      updateData.name = name;
      updateData.contactLastName = name.split(' ').slice(1).join(' ') || name;
      updateData.contactFirstName = name.split(' ')[0] || name;
    }
    if (address) {
      updateData.addressLine1 = address;
      updateData.addressLine2 = address;
      updateData.address = address;
    }
    if (phone) updateData.phone = phone;
    if (email) updateData.email = email;

    await customerModel.updateMany(query, { $set: updateData });

    res.status(200).json({
      success: true,
      msg: "Your Profile has been updated",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      msg: "Your Profile has not been updated due to " + err.message,
    });
  }
};

/**
 * 8. Change Customer Password
 */
const changepwd = async (req, res) => {
  try {
    const email = req.params.email;
    const pwd = req.params.pwd;
    const hashpwd = await hashPassword(pwd);

    await customerModel.updateOne(
      { email: { $regex: new RegExp(`^${email}$`, 'i') } },
      { $set: { pwd: hashpwd } }
    );

    res.status(200).json({
      success: true,
      msg: "Your Password has been updated",
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      msg: "Your Password has not been updated due to " + err.message,
    });
  }
};

/**
 * 9. Check if Email Exists
 */
const getEmail = async (req, res) => {
  try {
    const email = req.params.email;
    const count = await customerModel.countDocuments({
      email: { $regex: new RegExp(`^${email}$`, 'i') },
    });

    if (count > 0) {
      return res.status(200).json({
        success: true,
        msg: "email id already exist please choose different",
      });
    } else {
      return res.status(200).json({
        success: false,
        msg: "email id not exist",
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
};

/**
 * 10. Get Current Authenticated Customer Profile
 */
const getCustomerProfile = async (req, res) => {
  try {
    const customer = await customerModel.findById(req.user._id || req.user.id).select('-pwd');
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }
    res.json({ success: true, customer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export {
  getAllcustomer,
  addcustomer,
  getpwd,
  getcomppwd,
  authlogin,
  getEmail,
  updatecustomer,
  changepwd,
  verifyEmailCode,
  resendVerificationCode,
  getSimulatedVerificationCode,
  getCustomerProfile,
};