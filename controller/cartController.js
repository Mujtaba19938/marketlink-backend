import cartModel from '../model/cart.model.js';
import productModel from '../model/product.model.js';

const DELIVERY_FEE = 3.50;

/**
 * Helper to get or create a cart for a customer
 */
const getOrCreateCart = async (customerId, deliveryType = 'delivery') => {
  let cart = await cartModel.findOne({ customerId });
  if (!cart) {
    cart = new cartModel({
      customerId,
      items: [],
      deliveryType,
      subtotal: 0,
      deliveryCharge: deliveryType === 'delivery' ? DELIVERY_FEE : 0,
      grandTotal: deliveryType === 'delivery' ? DELIVERY_FEE : 0,
    });
    await cart.save();
  }
  return cart;
};

/**
 * 1. Get Cart (with live pricing and stock validation)
 */
export const getCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id || req.query.customerId || req.headers['x-customer-id'] || 'guest_patron';
    const deliveryType = req.query.deliveryType || 'delivery';

    const cart = await getOrCreateCart(customerId, deliveryType);

    // Revalidate live prices and availability against product collection
    let hasChanges = false;
    let validatedSubtotal = 0;

    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];
      const prod = await productModel.findOne({
        $or: [
          { _id: item.productId?.match(/^[0-9a-fA-F]{24}$/) ? item.productId : null },
          { productID: !isNaN(item.productID || item.productId) ? Number(item.productID || item.productId) : null },
          { name: item.name },
        ].filter(Boolean),
      });

      if (prod) {
        const livePrice = Number(prod.price || prod.buyPrice || item.price);
        if (item.price !== livePrice) {
          item.price = livePrice;
          hasChanges = true;
        }
        validatedSubtotal += livePrice * item.quantity;
      } else {
        validatedSubtotal += (item.price || 0) * item.quantity;
      }
    }

    cart.subtotal = Number(validatedSubtotal.toFixed(2));
    cart.deliveryCharge = cart.deliveryType === 'delivery' ? DELIVERY_FEE : 0;
    cart.grandTotal = Number((cart.subtotal + cart.deliveryCharge).toFixed(2));

    if (hasChanges) {
      await cart.save();
    }

    res.json({
      success: true,
      cart,
      itemCount: cart.items.reduce((sum, it) => sum + it.quantity, 0),
      subtotal: cart.subtotal,
      deliveryCharge: cart.deliveryCharge,
      grandTotal: cart.grandTotal,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 2. Add Product to Cart
 */
export const addToCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id || req.body.customerId || 'guest_patron';
    const { productId, productID, quantity = 1, deliveryType } = req.body;

    // Fetch product to ensure live price & stock
    const prod = await productModel.findOne({
      $or: [
        { _id: productId?.match(/^[0-9a-fA-F]{24}$/) ? productId : null },
        { productID: !isNaN(productID || productId) ? Number(productID || productId) : null },
      ].filter(Boolean),
    });

    if (!prod) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const availableStock = prod.stock || prod.quantityInStock || 100;
    const qtyToAdd = Math.max(1, parseInt(quantity) || 1);

    const cart = await getOrCreateCart(customerId, deliveryType);

    const existingIndex = cart.items.findIndex(
      (it) => it.productId === prod._id.toString() || it.productID === prod.productID
    );

    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + qtyToAdd;
      if (newQty > availableStock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more. Available stock is ${availableStock} ${prod.unit || 'units'}.`,
        });
      }
      cart.items[existingIndex].quantity = newQty;
      cart.items[existingIndex].price = Number(prod.price || prod.buyPrice);
    } else {
      cart.items.push({
        productId: prod._id.toString(),
        productID: prod.productID,
        name: prod.name || prod.productName,
        price: Number(prod.price || prod.buyPrice),
        quantity: qtyToAdd,
        unit: prod.unit || 'kg',
        imageType: prod.imageType || 'cabbage',
        image: prod.image,
        farmerName: prod.farmerName || prod.productVendor,
      });
    }

    cart.calculateTotals();
    await cart.save();

    res.json({
      success: true,
      message: `${prod.name || prod.productName} added to cart`,
      cart,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 3. Update Cart Item Quantity
 */
export const updateCartItem = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id || req.body.customerId || 'guest_patron';
    const { productId, quantity } = req.body;

    const cart = await getOrCreateCart(customerId);

    const itemIndex = cart.items.findIndex(
      (it) => it.productId === productId || it.productID?.toString() === productId?.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({ success: false, message: "Item not in cart" });
    }

    const newQty = parseInt(quantity);
    if (newQty <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = newQty;
    }

    cart.calculateTotals();
    await cart.save();

    res.json({ success: true, cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 4. Remove Item from Cart
 */
export const removeFromCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id || req.body.customerId || 'guest_patron';
    const { productId } = req.params;

    const cart = await getOrCreateCart(customerId);
    cart.items = cart.items.filter(
      (it) => it.productId !== productId && it.productID?.toString() !== productId?.toString()
    );

    cart.calculateTotals();
    await cart.save();

    res.json({ success: true, message: "Item removed from cart", cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 5. Clear Cart
 */
export const clearCart = async (req, res) => {
  try {
    const customerId = req.user?._id || req.user?.id || req.body.customerId || 'guest_patron';
    const cart = await getOrCreateCart(customerId);
    cart.items = [];
    cart.calculateTotals();
    await cart.save();

    res.json({ success: true, message: "Cart cleared", cart });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * 6. Calculate Totals (Instant server-side pricing engine)
 */
export const calculateTotals = async (req, res) => {
  try {
    const { items = [], deliveryType = 'delivery' } = req.body;

    let subtotal = 0;
    for (const it of items) {
      const prodId = it.id || it.productId || it.productID;
      const prod = await productModel.findOne({
        $or: [
          { _id: prodId?.match(/^[0-9a-fA-F]{24}$/) ? prodId : null },
          { productID: !isNaN(prodId) ? Number(prodId) : null },
          { name: it.name },
        ].filter(Boolean),
      });

      const price = prod ? Number(prod.price || prod.buyPrice) : Number(it.price || it.buyPrice || 0);
      const qty = Number(it.quantity || it.qty || 1);
      subtotal += price * qty;
    }

    subtotal = Number(subtotal.toFixed(2));
    const deliveryCharge = deliveryType.toLowerCase() === 'delivery' ? DELIVERY_FEE : 0;
    const grandTotal = Number((subtotal + deliveryCharge).toFixed(2));

    res.json({
      success: true,
      subtotal,
      deliveryCharge,
      grandTotal,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  calculateTotals,
};
