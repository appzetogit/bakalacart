import Order from '../../order/models/Order.js';
import OrderSettlement from '../../order/models/OrderSettlement.js';
import Delivery from '../../delivery/models/Delivery.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import mongoose from 'mongoose';
import fs from 'fs';

/**
 * Get all orders for admin
 * GET /api/admin/orders
 * Query params: status, page, limit, search, fromDate, toDate, restaurant, paymentStatus
 */
export const getOrders = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 50,
      search,
      fromDate,
      toDate,
      restaurant,
      paymentStatus,
      deliveryType,
      minAmount,
      maxAmount,
      zone,
      customer,
      cancelledBy,
      deliveryPartner
    } = req.query;

    // Build query
    const query = {};


    // Status filter
    if (status && status !== 'all') {
      // Map frontend status keys to backend status values
      const statusMap = {
        'scheduled': 'scheduled',
        'pending': 'pending',
        'accepted': 'confirmed',
        'processing': 'preparing',
        'food-on-the-way': 'out_for_delivery',
        'delivered': 'delivered',
        'canceled': 'cancelled',
        'restaurant-cancelled': 'cancelled', // Restaurant cancelled orders
        'payment-failed': 'pending', // Payment failed orders have pending status
        'refunded': 'cancelled', // Refunded orders might be cancelled
        'dine-in': 'dine_in',
        'offline-payments': 'pending' // Offline payment orders
      };

      const mappedStatus = statusMap[status] || status;
      query.status = mappedStatus;

      // Special handling for offline-payments to filter by payment method
      if (status === 'offline-payments') {
        query['payment.method'] = { $nin: ['razorpay', 'cash', 'wallet'] };
      }

      // If restaurant-cancelled, filter by cancelledBy or cancellation reason
      if (status === 'restaurant-cancelled') {
        query.$or = [
          { cancelledBy: 'restaurant' },
          { cancellationReason: { $regex: /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i } }
        ];
      }
    }

    // Also handle cancelledBy query parameter (if passed separately)
    if (cancelledBy === 'restaurant') {
      query.status = 'cancelled';
      query.$or = [
        { cancelledBy: 'restaurant' },
        { cancellationReason: { $regex: /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i } }
      ];
    }

    // Payment status filter
    if (paymentStatus) {
      const pmfMap = {
        'paid': 'completed',
        'unpaid': 'pending',
        'pending': 'pending',
        'failed': 'failed',
        'refunded': 'refunded',
        'processing': 'processing'
      };
      query['payment.status'] = pmfMap[paymentStatus.toLowerCase()] || paymentStatus.toLowerCase();
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      query['pricing.total'] = {};
      if (minAmount) query['pricing.total'].$gte = parseFloat(minAmount);
      if (maxAmount) query['pricing.total'].$lte = parseFloat(maxAmount);
    }

    // Delivery Type filter
    if (deliveryType) {
      if (deliveryType === 'Home Delivery') {
        query.deliveryFleet = { $in: ['standard', 'fast', null, ''] };
        if (!query.status) query.status = { $ne: 'dine_in' };
      } else if (deliveryType === 'Dine In') {
        query.status = 'dine_in';
      } else if (deliveryType === 'Take Away') {
        query.status = 'takeaway';
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // 1. Data pre-fetching for filters (parallelize lookups)
    const lookupPromises = [];

    // Restaurant lookup
    let restaurantIdFilter = null;
    if (restaurant && restaurant !== 'All restaurants') {
      lookupPromises.push((async () => {
        try {
          const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
          const doc = await Restaurant.findOne({
            $or: [
              { name: { $regex: restaurant, $options: 'i' } },
              { _id: mongoose.Types.ObjectId.isValid(restaurant) ? restaurant : null },
              { restaurantId: restaurant }
            ]
          }).select('_id restaurantId').lean();
          if (doc) restaurantIdFilter = doc._id?.toString() || doc.restaurantId;
        } catch (e) { console.error('Restaurant lookup error:', e); }
      })());
    }

    // Zone lookup
    let zoneIdFilter = null;
    if (zone && zone !== 'All Zones') {
      lookupPromises.push((async () => {
        try {
          const Zone = (await import('../models/Zone.js')).default;
          const doc = await Zone.findOne({
            name: { $regex: zone, $options: 'i' }
          }).select('_id name').lean();
          if (doc) zoneIdFilter = doc._id;
        } catch (e) { console.error('Zone lookup error:', e); }
      })());
    }

    // Customer lookup
    let customerUserIdFilter = null;
    if (customer && customer !== 'All customers') {
      lookupPromises.push((async () => {
        try {
          const User = (await import('../../auth/models/User.js')).default;
          const doc = await User.findOne({
            name: { $regex: customer, $options: 'i' }
          }).select('_id').lean();
          if (doc) customerUserIdFilter = doc._id;
        } catch (e) { console.error('Customer lookup error:', e); }
      })());
    }

    // Delivery Partner lookup
    let deliveryPartnerIdFilter = null;
    if (deliveryPartner && deliveryPartner !== 'All delivery partners') {
      lookupPromises.push((async () => {
        try {
          const Delivery = (await import('../../delivery/models/Delivery.js')).default;
          // Could be name or exact ID
          if (mongoose.Types.ObjectId.isValid(deliveryPartner)) {
            deliveryPartnerIdFilter = new mongoose.Types.ObjectId(deliveryPartner);
          } else {
            const doc = await Delivery.findOne({
              name: { $regex: deliveryPartner, $options: 'i' }
            }).select('_id').lean();
            if (doc) deliveryPartnerIdFilter = doc._id;
          }
        } catch (e) { console.error('Delivery Partner lookup error:', e); }
      })());
    }

    // Search lookups
    let searchUserIds = [];
    if (search) {
      lookupPromises.push((async () => {
        try {
          const User = (await import('../../auth/models/User.js')).default;
          const cleanSearch = search.replace(/\D/g, '');
          const searchQueries = [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ];
          if (cleanSearch) {
            searchQueries.push({ phone: { $regex: cleanSearch, $options: 'i' } });
          }
          if (mongoose.Types.ObjectId.isValid(search)) {
            searchQueries.push({ _id: search });
          }
          const users = await User.find({ $or: searchQueries }).select('_id').lean();
          searchUserIds = users.map(u => u._id);
        } catch (e) { console.error('Search lookup error:', e); }
      })());
    }

    await Promise.all(lookupPromises);

    // 2. Build the main query
    if (restaurantIdFilter) query.restaurantId = restaurantIdFilter;
    if (zoneIdFilter) {
      query['assignmentInfo.zoneId'] = zoneIdFilter;
    } else if (zone && zone !== 'All Zones') {
      // If zone was specified but not found, force empty results
      query['assignmentInfo.zoneId'] = new mongoose.Types.ObjectId();
    }
    if (customerUserIdFilter) query.userId = customerUserIdFilter;
    if (deliveryPartnerIdFilter) query.deliveryPartnerId = deliveryPartnerIdFilter;

    if (search) {
      const searchOrConditions = [{ orderId: { $regex: search, $options: 'i' } }];
      if (searchUserIds.length > 0) {
        searchOrConditions.push({ userId: { $in: searchUserIds } });
      }

      if (searchOrConditions.length > 0) {
        if (query.$or) {
          const existingOr = query.$or;
          delete query.$or;
          query.$and = [{ $or: existingOr }, { $or: searchOrConditions }];
        } else {
          query.$or = searchOrConditions;
        }
      }
    }

    // 3. Parallel execution for main results and stats
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    console.log('📊 Parallelizing count, find, and status stats...');
    const [total, orders, rawStatusCounts] = await Promise.all([
      Order.countDocuments(query),
      Order.find(query)
        .populate('userId', 'name email phone')
        .populate('restaurantId', 'name slug')
        .populate('deliveryPartnerId', 'name phone')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip)
        .lean(),
      Order.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    // Map status counts to friendly names
    const statusCounts = {
      total: total,
      Scheduled: 0,
      Pending: 0,
      Accepted: 0,
      Processing: 0,
      "Food On The Way": 0,
      Delivered: 0,
      Canceled: 0,
      "Payment Failed": 0,
      Refunded: 0
    };

    rawStatusCounts.forEach(item => {
      const status = item._id;
      const count = item.count;

      if (status === 'scheduled') statusCounts.Scheduled += count;
      else if (status === 'pending') statusCounts.Pending += count;
      else if (status === 'confirmed') statusCounts.Accepted += count;
      else if (status === 'preparing') statusCounts.Processing += count;
      else if (status === 'out_for_delivery') statusCounts["Food On The Way"] += count;
      else if (status === 'delivered') statusCounts.Delivered += count;
      else if (status === 'cancelled') statusCounts.Canceled += count;
    });

    // 4. Batch fetch auxiliary data (same as before but cleaner)
    let settlementMap = new Map();
    let refundStatusMap = new Map();
    let paymentMap = new Map();

    if (orders.length > 0) {
      try {
        const OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
        const Payment = (await import('../../payment/models/Payment.js')).default;
        const orderIds = orders.map(o => o._id);

        const [settlements, payments] = await Promise.all([
          OrderSettlement.find({ orderId: { $in: orderIds } }).select('orderId userPayment.platformFee cancellationDetails.refundStatus').lean(),
          Payment.find({ orderId: { $in: orderIds } }).select('orderId status').lean()
        ]);

        settlements.forEach(s => {
          if (s.orderId) {
            const oid = s.orderId.toString();
            if (s.userPayment?.platformFee !== undefined) settlementMap.set(oid, s.userPayment.platformFee);
            if (s.cancellationDetails?.refundStatus) refundStatusMap.set(oid, s.cancellationDetails.refundStatus);
          }
        });
        payments.forEach(p => { if (p.orderId) paymentMap.set(p.orderId.toString(), p.status); });
      } catch (err) { console.warn('Auxiliary fetch error:', err.message); }
    }

    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (unmasked - show full number for admin)
      const customerPhone = order.userId?.phone || '';

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Unpaid',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };

      // Get payment status from order or payment record (fallback)
      const dbPaymentStatus = order.payment?.status;
      const paymentRecordStatus = paymentMap.get(order._id.toString());
      const effectivePaymentStatus = paymentRecordStatus || dbPaymentStatus;

      const paymentStatusDisplay = paymentStatusMap[effectivePaymentStatus] || 'Unpaid';

      // Map order status for display
      // Check if cancelled and determine who cancelled it
      let orderStatusDisplay;
      if (order.status === 'cancelled') {
        // Check cancelledBy field to determine who cancelled
        if (order.cancelledBy === 'restaurant') {
          orderStatusDisplay = 'Cancelled by Restaurant';
        } else if (order.cancelledBy === 'user') {
          orderStatusDisplay = 'Cancelled by User';
        } else {
          // Fallback: check cancellation reason pattern for old orders
          const cancellationReason = order.cancellationReason || '';
          const isRestaurantCancelled = /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i.test(cancellationReason);
          orderStatusDisplay = isRestaurantCancelled ? 'Cancelled by Restaurant' : 'Cancelled by User';
        }
      } else {
        const statusMap = {
          'pending': 'Pending',
          'confirmed': 'Accepted',
          'preparing': 'Processing',
          'ready': 'Ready',
          'out_for_delivery': 'Food On The Way',
          'delivered': 'Delivered',
          'scheduled': 'Scheduled',
          'dine_in': 'Dine In'
        };
        orderStatusDisplay = statusMap[order.status] || order.status;
      }

      // Determine delivery type
      const deliveryType = order.deliveryFleet === 'standard' ?
        'Home Delivery' :
        (order.deliveryFleet === 'fast' ? 'Fast Delivery' : 'Home Delivery');

      // Calculate report-specific fields
      const subtotal = order.pricing?.subtotal || 0;
      const discount = order.pricing?.discount || 0;
      const deliveryFee = order.pricing?.deliveryFee || 0;
      const tax = order.pricing?.tax || 0;
      const couponCode = order.pricing?.couponCode || null;

      // Get platform fee - check if it exists in pricing, otherwise get from settlement map
      let platformFee = order.pricing?.platformFee;
      if (platformFee === undefined || platformFee === null) {
        // Get from settlement map (batch fetched above)
        platformFee = settlementMap.get(order._id.toString());

        // If still not found, calculate from total (fallback for old orders)
        if (platformFee === undefined || platformFee === null) {
          const calculatedTotal = (order.pricing?.subtotal || 0) - (order.pricing?.discount || 0) + (order.pricing?.deliveryFee || 0) + (order.pricing?.tax || 0);
          const actualTotal = order.pricing?.total || 0;
          const difference = actualTotal - calculatedTotal;
          // If difference is positive and reasonable (between 0 and 50), assume it's platform fee
          platformFee = (difference > 0 && difference <= 50) ? difference : 0;
        }
      }

      // For report: itemDiscount is the discount applied to items
      const itemDiscount = discount;
      // Discounted amount is subtotal after discount
      const discountedAmount = Math.max(0, subtotal - discount);
      // Coupon discount (if coupon was applied, it's part of discount)
      const couponDiscount = couponCode ? discount : 0;
      // Referral discount (not currently in model, default to 0)
      const referralDiscount = 0;
      // VAT/Tax
      const vatTax = tax;
      // Delivery charge
      const deliveryCharge = deliveryFee;
      // Total item amount (subtotal before discounts)
      const totalItemAmount = subtotal;
      // Order amount (final total)
      const orderAmount = order.pricing?.total || 0;

      return {
        sl: skip + index + 1,
        orderId: order.orderId,
        id: order._id.toString(),
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: customerPhone,
        customerEmail: order.userId?.email || '',
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        // Report-specific fields
        totalItemAmount: totalItemAmount,
        itemDiscount: itemDiscount,
        discountedAmount: discountedAmount,
        couponDiscount: couponDiscount,
        referralDiscount: referralDiscount,
        vatTax: vatTax,
        deliveryCharge: deliveryCharge,
        platformFee: platformFee,
        totalAmount: orderAmount,
        // Original fields
        paymentStatus: paymentStatusDisplay,
        paymentType: (() => {
          const paymentMethod = order.payment?.method;
          if (paymentMethod === 'cash' || paymentMethod === 'cod') {
            return 'Cash on Delivery';
          } else if (paymentMethod === 'wallet') {
            return 'Wallet';
          } else if (paymentMethod === 'razorpay') {
            return 'Online (Razorpay)';
          } else if (paymentMethod) {
            // Capitalize first letter of payment method
            return `Offline (${paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)})`;
          } else {
            return 'Online';
          }
        })(),
        paymentCollectionStatus: (() => {
          const method = order.payment?.method;
          const isCod = method === 'cash' || method === 'cod';

          if (isCod) {
            return (order.status === 'delivered' ? 'Collected' : 'Not Collected');
          } else {
            // For online payments, use the effective payment status
            // It is collected only if payment is completed
            return (effectivePaymentStatus === 'completed') ? 'Collected' : 'Not Collected';
          }
        })(),
        orderStatus: orderStatusDisplay,
        status: order.status, // Backend status
        deliveryType: deliveryType,
        items: order.items || [],
        address: order.address || {},
        deliveryPartnerName: order.deliveryPartnerId?.name || null,
        deliveryPartnerPhone: order.deliveryPartnerId?.phone || null,
        estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
        deliveredAt: order.deliveredAt,
        note: order.note || null,
        cancellationReason: order.cancellationReason || null,
        cancelledAt: order.cancelledAt || null,
        cancelledBy: order.cancelledBy || null,
        tracking: order.tracking || {},
        deliveryState: order.deliveryState || {},
        billImageUrl: order.billImageUrl || null, // Bill image captured by delivery boy
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        // Zone info from assignmentInfo
        zoneId: order.assignmentInfo?.zoneId || null,
        zoneName: order.assignmentInfo?.zoneName || null,
        // Refund status from settlement
        refundStatus: refundStatusMap.get(order._id.toString()) || null
      };
    });

    return successResponse(res, 200, 'Orders retrieved successfully', {
      orders: transformedOrders,
      statusCounts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return errorResponse(res, 500, 'Failed to fetch orders');
  }
});

/**
 * Get order by ID for admin
 * GET /api/admin/orders/:id
 */
export const getOrderById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    let order = null;

    // Try MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findById(id)
        .populate('userId', 'name email phone')
        .populate('restaurantId', 'name slug location address phone')
        .populate('deliveryPartnerId', 'name phone availability')
        .lean();
    }

    // If not found, try by orderId
    if (!order) {
      order = await Order.findOne({ orderId: id })
        .populate('userId', 'name email phone')
        .populate('restaurantId', 'name slug location address phone')
        .populate('deliveryPartnerId', 'name phone availability')
        .lean();
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    return successResponse(res, 200, 'Order retrieved successfully', {
      order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    return errorResponse(res, 500, 'Failed to fetch order');
  }
});

/**
 * Get orders searching for deliveryman (ready orders without delivery partner)
 * GET /api/admin/orders/searching-deliveryman
 * Query params: page, limit, search
 */
export const getSearchingDeliverymanOrders = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching searching deliveryman orders...');
    const {
      page = 1,
      limit = 50,
      search
    } = req.query;

    console.log('📋 Query params:', { page, limit, search });

    // Build base conditions for orders that are ready but don't have delivery partner assigned
    // deliveryPartnerId is ObjectId, so we only check for null or missing
    const baseConditions = {
      status: { $in: ['ready', 'preparing'] },
      $or: [
        { deliveryPartnerId: { $exists: false } },
        { deliveryPartnerId: null }
      ]
    };

    // Build search conditions if search is provided
    let searchConditions = null;
    if (search) {
      const searchOrConditions = [
        { orderId: { $regex: search, $options: 'i' } }
      ];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = { phone: { $regex: cleanSearch, $options: 'i' } };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          searchOrConditions.push({ userId: { $in: userIds } });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        searchOrConditions.push({ userId: { $in: userIdsByName } });
      }

      if (searchOrConditions.length > 0) {
        searchConditions = { $or: searchOrConditions };
      }
    }

    // Combine all conditions
    const finalQuery = searchConditions
      ? { $and: [baseConditions, searchConditions] }
      : baseConditions;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔎 Final query:', JSON.stringify(finalQuery, null, 2));

    // Fetch orders with population
    const orders = await Order.find(finalQuery)
      .populate('userId', 'name email phone')
      .populate('restaurantId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Order.countDocuments(finalQuery);

    console.log(`✅ Found ${orders.length} orders (total: ${total})`);

    // Batch fetch payment statuses
    let paymentMap = new Map();
    try {
      const Payment = (await import('../../payment/models/Payment.js')).default;
      const orderIds = orders.map(o => o._id);
      const payments = await Payment.find({ orderId: { $in: orderIds } })
        .select('orderId status')
        .lean();

      payments.forEach(p => {
        if (p.orderId) {
          paymentMap.set(p.orderId.toString(), p.status);
        }
      });
    } catch (err) {
      console.warn('Could not batch fetch payments:', err.message);
    }

    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (masked for display)
      const customerPhone = order.userId?.phone || '';
      let maskedPhone = '';
      if (customerPhone && customerPhone.length > 2) {
        maskedPhone = `+${customerPhone.slice(0, 1)}${'*'.repeat(Math.max(0, customerPhone.length - 2))}${customerPhone.slice(-1)}`;
      } else if (customerPhone) {
        maskedPhone = customerPhone; // If too short, show as is
      }

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Unpaid',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };

      // Get payment status from order or payment record (fallback)
      const dbPaymentStatus = order.payment?.status;
      const paymentRecordStatus = paymentMap.get(order._id.toString());
      const effectivePaymentStatus = paymentRecordStatus || dbPaymentStatus;

      const paymentStatusDisplay = paymentStatusMap[effectivePaymentStatus] || 'Unpaid';

      // Map order status for display
      const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Accepted',
        'preparing': 'Pending',
        'ready': 'Pending',
        'out_for_delivery': 'Food On The Way',
        'delivered': 'Delivered',
        'cancelled': 'Canceled',
        'scheduled': 'Scheduled',
        'dine_in': 'Dine In'
      };
      const orderStatusDisplay = statusMap[order.status] || 'Pending';

      // Determine delivery type
      const deliveryType = order.deliveryFleet === 'standard' ?
        'Home Delivery' :
        (order.deliveryFleet === 'fast' ? 'Fast Delivery' : 'Home Delivery');

      // Format total amount
      const totalAmount = order.pricing?.total || 0;
      const formattedTotal = `$ ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return {
        id: order.orderId || order._id.toString(),
        sl: skip + index + 1,
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: maskedPhone,
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        total: formattedTotal,
        paymentStatus: paymentStatusDisplay,
        paymentCollectionStatus: (() => {
          const method = order.payment?.method;
          const isCod = method === 'cash' || method === 'cod';

          if (isCod) {
            return (order.status === 'delivered' ? 'Collected' : 'Not Collected');
          } else {
            return (effectivePaymentStatus === 'completed') ? 'Collected' : 'Not Collected';
          }
        })(),
        orderStatus: orderStatusDisplay,
        deliveryType: deliveryType,
        // Additional fields for view order dialog
        orderId: order.orderId,
        _id: order._id.toString(),
        customerEmail: order.userId?.email || '',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        items: order.items || [],
        address: order.address || {},
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        pricing: order.pricing || {},
        note: order.note || null
      };
    });

    return successResponse(res, 200, 'Searching deliveryman orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching searching deliveryman orders:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch searching deliveryman orders');
  }
});

/**
 * Get ongoing orders (orders with delivery partner assigned but not delivered)
 * GET /api/admin/orders/ongoing
 * Query params: page, limit, search
 */
export const getOngoingOrders = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching ongoing orders...');
    const {
      page = 1,
      limit = 50,
      search
    } = req.query;

    console.log('📋 Query params:', { page, limit, search });

    // Build base conditions for ongoing orders
    // Orders that have deliveryPartnerId assigned but are not delivered/cancelled
    const baseConditions = {
      deliveryPartnerId: { $exists: true, $ne: null },
      status: { $nin: ['delivered', 'cancelled'] }
    };

    // Build search conditions if search is provided
    let searchConditions = null;
    if (search) {
      const searchOrConditions = [
        { orderId: { $regex: search, $options: 'i' } }
      ];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = { phone: { $regex: cleanSearch, $options: 'i' } };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          searchOrConditions.push({ userId: { $in: userIds } });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        searchOrConditions.push({ userId: { $in: userIdsByName } });
      }

      if (searchOrConditions.length > 0) {
        searchConditions = { $or: searchOrConditions };
      }
    }

    // Combine all conditions
    const finalQuery = searchConditions
      ? { $and: [baseConditions, searchConditions] }
      : baseConditions;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    console.log('🔎 Final query:', JSON.stringify(finalQuery, null, 2));

    // Fetch orders with population
    const orders = await Order.find(finalQuery)
      .populate('userId', 'name email phone')
      .populate('restaurantId', 'name slug')
      .populate('deliveryPartnerId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get total count
    const total = await Order.countDocuments(finalQuery);

    console.log(`✅ Found ${orders.length} ongoing orders (total: ${total})`);

    // Batch fetch payment statuses
    let paymentMap = new Map();
    try {
      const Payment = (await import('../../payment/models/Payment.js')).default;
      const orderIds = orders.map(o => o._id);
      const payments = await Payment.find({ orderId: { $in: orderIds } })
        .select('orderId status')
        .lean();

      payments.forEach(p => {
        if (p.orderId) {
          paymentMap.set(p.orderId.toString(), p.status);
        }
      });
    } catch (err) {
      console.warn('Could not batch fetch payments:', err.message);
    }

    // Transform orders to match frontend format
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Get customer phone (masked for display)
      const customerPhone = order.userId?.phone || '';
      let maskedPhone = '';
      if (customerPhone && customerPhone.length > 2) {
        maskedPhone = `+${customerPhone.slice(0, 1)}${'*'.repeat(Math.max(0, customerPhone.length - 2))}${customerPhone.slice(-1)}`;
      } else if (customerPhone) {
        maskedPhone = customerPhone; // If too short, show as is
      }

      // Map payment status
      const paymentStatusMap = {
        'completed': 'Paid',
        'pending': 'Unpaid',
        'failed': 'Failed',
        'refunded': 'Refunded',
        'processing': 'Processing'
      };

      // Get payment status from order or payment record (fallback)
      const dbPaymentStatus = order.payment?.status;
      const paymentRecordStatus = paymentMap.get(order._id.toString());
      const effectivePaymentStatus = paymentRecordStatus || dbPaymentStatus;

      const paymentStatusDisplay = paymentStatusMap[effectivePaymentStatus] || 'Unpaid';

      // Map order status for display with colors
      const statusMap = {
        'pending': { text: 'Pending', color: 'bg-gray-100 text-gray-600' },
        'confirmed': { text: 'Confirmed', color: 'bg-blue-50 text-blue-600' },
        'preparing': { text: 'Preparing', color: 'bg-yellow-50 text-yellow-600' },
        'ready': { text: 'Ready', color: 'bg-green-50 text-green-600' },
        'out_for_delivery': { text: 'Out For Delivery', color: 'bg-orange-100 text-orange-600' },
        'delivered': { text: 'Delivered', color: 'bg-green-100 text-green-600' },
        'cancelled': { text: 'Cancelled', color: 'bg-red-50 text-red-600' },
        'scheduled': { text: 'Scheduled', color: 'bg-purple-50 text-purple-600' },
        'dine_in': { text: 'Dine In', color: 'bg-indigo-50 text-indigo-600' }
      };

      // Check for handover status (when delivery partner has reached pickup)
      let orderStatusDisplay = statusMap[order.status]?.text || 'Pending';
      let orderStatusColor = statusMap[order.status]?.color || 'bg-gray-100 text-gray-600';

      // If delivery partner has reached pickup, show as "Handover"
      if (order.deliveryState?.currentPhase === 'at_pickup' ||
        order.deliveryState?.currentPhase === 'en_route_to_delivery' ||
        order.deliveryState?.currentPhase === 'at_delivery') {
        orderStatusDisplay = 'Handover';
        orderStatusColor = 'bg-blue-50 text-blue-600';
      }

      // Determine delivery type
      const deliveryType = order.deliveryFleet === 'standard' ?
        'Home Delivery' :
        (order.deliveryFleet === 'fast' ? 'Fast Delivery' : 'Home Delivery');

      // Format total amount
      const totalAmount = order.pricing?.total || 0;
      const formattedTotal = `$ ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return {
        id: order.orderId || order._id.toString(),
        sl: skip + index + 1,
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: maskedPhone,
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        total: formattedTotal,
        paymentStatus: paymentStatusDisplay,
        paymentCollectionStatus: (() => {
          const method = order.payment?.method;
          const isCod = method === 'cash' || method === 'cod';

          if (isCod) {
            return (order.status === 'delivered' ? 'Collected' : 'Not Collected');
          } else {
            return (effectivePaymentStatus === 'completed') ? 'Collected' : 'Not Collected';
          }
        })(),
        orderStatus: orderStatusDisplay,
        orderStatusColor: orderStatusColor,
        deliveryType: deliveryType,
        // Additional fields for view order dialog
        orderId: order.orderId,
        _id: order._id.toString(),
        customerEmail: order.userId?.email || '',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        items: order.items || [],
        address: order.address || {},
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        status: order.status,
        pricing: order.pricing || {},
        deliveryPartnerName: order.deliveryPartnerId?.name || null,
        deliveryPartnerPhone: order.deliveryPartnerId?.phone || null,
        note: order.note || null
      };
    });

    return successResponse(res, 200, 'Ongoing orders retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching ongoing orders:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch ongoing orders');
  }
});

/**
 * Get transaction report with summary statistics and order transactions
 * GET /api/admin/orders/transaction-report
 * Query params: page, limit, search, zone, restaurant, fromDate, toDate
 */
export const getTransactionReport = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching transaction report...');
    const {
      page = 1,
      limit = 50,
      search,
      zone,
      restaurant,
      fromDate,
      toDate
    } = req.query;

    console.log('📋 Query params:', { page, limit, search, zone, restaurant, fromDate, toDate });

    // Build query for orders
    const query = {};

    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.createdAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // 1. Data pre-fetching for filters (parallelize lookups)
    const lookupPromises = [];

    // Restaurant lookup
    let restaurantIdFilter = null;
    if (restaurant && restaurant !== 'All restaurants') {
      lookupPromises.push((async () => {
        try {
          const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
          const doc = await Restaurant.findOne({
            $or: [
              { name: { $regex: restaurant, $options: 'i' } },
              { _id: mongoose.Types.ObjectId.isValid(restaurant) ? restaurant : null },
              { restaurantId: restaurant }
            ]
          }).select('_id restaurantId').lean();
          if (doc) restaurantIdFilter = doc._id?.toString() || doc.restaurantId;
        } catch (e) { console.error('Restaurant lookup error:', e); }
      })());
    }

    // Zone lookup
    let zoneIdFilter = null;
    if (zone && zone !== 'All Zones') {
      lookupPromises.push((async () => {
        try {
          const Zone = (await import('../models/Zone.js')).default;
          const doc = await Zone.findOne({
            name: { $regex: zone, $options: 'i' }
          }).select('_id name').lean();
          if (doc) zoneIdFilter = doc._id?.toString();
        } catch (e) { console.error('Zone lookup error:', e); }
      })());
    }

    await Promise.all(lookupPromises);

    // 2. Build the main query
    if (restaurantIdFilter) query.restaurantId = restaurantIdFilter;
    if (zoneIdFilter) query['assignmentInfo.zoneId'] = zoneIdFilter;
    if (search) query.orderId = { $regex: search, $options: 'i' };

    // 3. Parallel execution for results, count, and summary aggregation
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build filters specifically matching Dashboard boxes (replicated from getDashboardStats)
    const dashboardMatch = {};
    if (query.createdAt) dashboardMatch.createdAt = query.createdAt;
    if (query.restaurantId) dashboardMatch.restaurantId = query.restaurantId;
    if (query.zoneId) dashboardMatch.zoneId = query.zoneId;

    // Fetch valid delivery partner IDs (Exactly like Dashboard Line 240)
    const validDeliveryPartners = await Delivery.find({}).select('_id').lean();
    const validDeliveryIds = validDeliveryPartners.map(d => d._id);

    console.log('📊 Transaction Report: Cloning Dashboard Stats Calculation...');
    const [orders, total, aggregateStats, walletStats, missingStats, settlementStats] = await Promise.all([
      Order.find(query)
        .populate('userId', 'name email phone')
        .populate('restaurantId', 'name slug')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .skip(skip)
        .lean(),
      Order.countDocuments(query),
      // 1. Basic Stats (Completed/Refunded totals)
      Order.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalCompleted: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "delivered"] }, { $ne: ["$deliveredAt", null] }] }, { $ifNull: ["$pricing.total", 0] }, 0] } },
            totalRefunded: { $sum: { $cond: [{ $or: [{ $eq: ["$payment.status", "refunded"] }, { $eq: ["$status", "cancelled"] }] }, { $ifNull: ["$pricing.total", 0] }, 0] } },
            cashTotal: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "delivered"] }, { $ne: ["$deliveredAt", null] }, { $or: [{ $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "cash"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "cash_on_delivery"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "cod"] }] }] }, { $ifNull: ["$pricing.total", 0] }, 0] } },
            onlineTotal: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "delivered"] }, { $ne: ["$deliveredAt", null] }, { $or: [{ $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "razorpay"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "online"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "card"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "wallet"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "upi"] }] }] }, { $ifNull: ["$pricing.total", 0] }, 0] } },
            cashCount: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "delivered"] }, { $ne: ["$deliveredAt", null] }, { $or: [{ $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "cash"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "cash_on_delivery"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "cod"] }] }] }, 1, 0] } },
            onlineCount: { $sum: { $cond: [{ $and: [{ $eq: ["$status", "delivered"] }, { $ne: ["$deliveredAt", null] }, { $or: [{ $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "razorpay"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "online"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "card"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "wallet"] }, { $eq: [{ $toLower: { $ifNull: ["$payment.method", ""] } }, "upi"] }] }] }, 1, 0] } }
          }
        }
      ]),
      // 2. Wallet Payouts (Dashboard 'DELIVERY FEE' component)
      DeliveryWallet.aggregate([
        { $unwind: '$transactions' },
        { 
          $match: { 
            deliveryId: { $in: validDeliveryIds },
            'transactions.type': 'payment', 
            'transactions.status': 'Completed',
            ...(dashboardMatch.createdAt ? { 'transactions.createdAt': dashboardMatch.createdAt } : {})
          } 
        },
        { $group: { _id: null, total: { $sum: '$transactions.amount' }, orderIds: { $push: '$transactions.orderId' } } }
      ]),
      // 3. Missing Delivery Orders (Dashboard 'DELIVERY FEE' missing component)
      Order.aggregate([
        { 
          $match: { 
            status: 'delivered', 
            ...(dashboardMatch.createdAt ? { deliveredAt: dashboardMatch.createdAt } : {}),
            deliveryPartnerId: { $in: validDeliveryIds }
          } 
        },
        { $group: { _id: null, total: { $sum: '$pricing.deliveryFee' }, allOrderIds: { $push: '$_id' } } }
      ]),
      // 4. Commission / PlatFee / GST (Dashboard boxes exactly)
      OrderSettlement.aggregate([
        { $match: dashboardMatch },
        { 
          $group: { 
            _id: null, 
            comm: { $sum: "$adminEarning.commission" },
            plat: { $sum: "$adminEarning.platformFee" },
            gst: { $sum: "$adminEarning.gst" },
            rest: { $sum: "$restaurantEarning.netEarning" },
            rid: { $sum: "$deliveryPartnerEarning.totalEarning" }
          } 
        }
      ])
    ]);

    // Calculate Dashboard-aligned Delivery Fee (replicated logic)
    const walletTotal = walletStats[0]?.total || 0;
    const processedOrderIds = new Set((walletStats[0]?.orderIds || []).map(id => id?.toString()).filter(Boolean));
    const allDeliveredOrders = missingStats[0]?.allOrderIds || [];
    
    // Fetch individual delivery fees for orders NOT in wallet (exactly like dashboard)
    const missingOrdersData = await Order.find({
      _id: { $in: allDeliveredOrders, $nin: Array.from(processedOrderIds).filter(id => mongoose.Types.ObjectId.isValid(id)) }
    }).select('pricing.deliveryFee').lean();
    
    const missingTotal = missingOrdersData.reduce((sum, o) => sum + (o.pricing?.deliveryFee || 0), 0);
    const dashboardDeliveryFee = walletTotal + missingTotal;

    const summaryStats = aggregateStats[0] || { totalCompleted: 0, totalRefunded: 0, cashTotal: 0, onlineTotal: 0, cashCount: 0, onlineCount: 0 };
    const settleStats = settlementStats[0] || { comm: 0, plat: 0, gst: 0, rest: 0, rid: 0 };

    // Final Revenue Breakdown (Perfect 100% sync with Dashboard)
    const adminEarning = (settleStats.comm || 0) + 
                         (settleStats.plat || 0) + 
                         (settleStats.gst || 0) + 
                         dashboardDeliveryFee;

    const restaurantEarning = settleStats.rest || 0;
    const deliverymanEarning = settleStats.rid || 0;

    const summary = {
      completedTransaction: summaryStats.totalCompleted || 0,
      refundedTransaction: summaryStats.totalRefunded || 0,
      adminEarning: adminEarning,
      restaurantEarning: restaurantEarning,
      deliverymanEarning: deliverymanEarning,
      cashTotal: summaryStats.cashTotal || 0,
      onlineTotal: summaryStats.onlineTotal || 0,
      cashCount: summaryStats.cashCount || 0,
      onlineCount: summaryStats.onlineCount || 0
    };

    // Transform orders to match frontend format
    const transformedTransactions = orders.map((order, index) => {
      const subtotal = order.pricing?.subtotal || 0;
      const discount = order.pricing?.discount || 0;
      const deliveryFee = order.pricing?.deliveryFee || 0;
      const tax = order.pricing?.tax || 0;
      const couponCode = order.pricing?.couponCode || null;

      // For report: itemDiscount is the discount applied to items
      const itemDiscount = discount;
      // Discounted amount is subtotal after discount
      const discountedAmount = Math.max(0, subtotal - discount);
      // Coupon discount (if coupon was applied, it's part of discount)
      const couponDiscount = couponCode ? discount : 0;
      // Referral discount (not currently in model, default to 0)
      const referralDiscount = 0;
      // VAT/Tax
      const vatTax = tax;
      // Delivery charge
      const deliveryCharge = deliveryFee;
      // Total item amount (subtotal before discounts)
      const totalItemAmount = subtotal;
      // Order amount (final total)
      const orderAmount = order.pricing?.total || 0;

      // Get payment method
      const paymentMethod = order.payment?.method || 'unknown';

      return {
        id: order._id.toString(),
        orderId: order.orderId,
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        customerName: order.userId?.name || 'Invalid Customer Data',
        totalItemAmount: totalItemAmount,
        itemDiscount: itemDiscount,
        couponDiscount: couponDiscount,
        referralDiscount: referralDiscount,
        discountedAmount: discountedAmount,
        vatTax: vatTax,
        deliveryCharge: deliveryCharge,
        orderAmount: orderAmount,
        paymentMethod: paymentMethod,
        note: order.note || null
      };
    });

    return successResponse(res, 200, 'Transaction report retrieved successfully', {
      summary: {
        completedTransaction: summaryStats.totalCompleted,
        refundedTransaction: summaryStats.totalRefunded,
        adminEarning,
        restaurantEarning,
        deliverymanEarning,
        cashTotal: summaryStats.cashTotal || 0,
        onlineTotal: summaryStats.onlineTotal || 0,
        cashCount: summaryStats.cashCount || 0,
        onlineCount: summaryStats.onlineCount || 0
      },
      transactions: transformedTransactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching transaction report:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch transaction report');
  }
});

/**
 * Get restaurant report with statistics for each restaurant
 * GET /api/admin/orders/restaurant-report
 * Query params: zone, all (active/inactive), type (commission/subscription), time, search
 */
export const getRestaurantReport = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 Fetching restaurant report...');
    const {
      zone,
      all,
      type,
      time,
      search
    } = req.query;

    console.log('📋 Query params:', { zone, all, type, time, search });

    const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
    const AdminCommission = (await import('../models/AdminCommission.js')).default;
    const FeedbackExperience = (await import('../models/FeedbackExperience.js')).default;

    // Build restaurant query
    const restaurantQuery = {};

    // Zone filter
    if (zone && zone !== 'All Zones') {
      const Zone = (await import('../models/Zone.js')).default;
      const zoneDoc = await Zone.findOne({
        name: { $regex: zone, $options: 'i' }
      }).select('_id name').lean();

      if (zoneDoc) {
        // Find restaurants in this zone by checking orders with this zoneId
        const ordersInZone = await Order.find({
          'assignmentInfo.zoneId': zoneDoc._id?.toString()
        }).distinct('restaurantId').lean();

        if (ordersInZone.length > 0) {
          restaurantQuery.$or = [
            { _id: { $in: ordersInZone } },
            { restaurantId: { $in: ordersInZone } }
          ];
        } else {
          // No restaurants found in this zone
          return successResponse(res, 200, 'Restaurant report retrieved successfully', {
            restaurants: [],
            pagination: {
              page: 1,
              limit: 1000,
              total: 0,
              pages: 0
            }
          });
        }
      }
    }

    // Active/Inactive filter
    if (all && all !== 'All') {
      restaurantQuery.isActive = all === 'Active';
    }

    // Search filter
    if (search) {
      restaurantQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { restaurantId: { $regex: search, $options: 'i' } }
      ];
    }

    // Date range filter for orders
    let dateQuery = {};
    if (time && time !== 'All Time') {
      const now = new Date();
      dateQuery.createdAt = {};

      if (time === 'Today') {
        const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek;
        const startDate = new Date(now.getFullYear(), now.getMonth(), diff);
        const endDate = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Month') {
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      } else if (time === 'This Year') {
        const startDate = new Date(now.getFullYear(), 0, 1);
        const endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        dateQuery.createdAt.$gte = startDate;
        dateQuery.createdAt.$lte = endDate;
      }
    }

    // Extract page and limit for pagination
    const { page = 1, limit = 25 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // 1. Fetch paginated restaurants first
    const [totalRestaurants, restaurants] = await Promise.all([
      Restaurant.countDocuments(restaurantQuery),
      Restaurant.find(restaurantQuery)
        .select('_id restaurantId name profileImage rating totalRatings isActive')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean()
    ]);

    console.log(`📊 Found ${totalRestaurants} restaurants in total, showing ${restaurants.length} on page ${pageNum}`);

    // Bulk fetch statistics to avoid N+1 query issue
    const restaurantIds = restaurants.map(r => r._id?.toString());
    const restaurantIdFields = restaurants.map(r => r.restaurantId).filter(Boolean);
    const allRestaurantIdsForOrders = [...new Set([...restaurantIds, ...restaurantIdFields])];

    console.log(`📊 Fetching bulk statistics for ${restaurants.length} restaurants on current page...`);

    // Define commissionDateQuery for AdminCommission aggregation
    const commissionDateQuery = dateQuery.createdAt ? { orderDate: dateQuery.createdAt } : {};

    // 1. Order Stats Aggregation (Filtered by restaurants on this page)
    const orderStats = await Order.aggregate([
      {
        $match: {
          ...dateQuery,
          restaurantId: { $in: allRestaurantIdsForOrders }
        }
      },
      {
        $group: {
          _id: "$restaurantId",
          totalOrders: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ["$pricing.total", 0] } },
          totalDiscount: { $sum: { $ifNull: ["$pricing.discount", 0] } },
          totalTax: { $sum: { $ifNull: ["$pricing.tax", 0] } },
          items: { $push: "$items" }
        }
      }
    ]);

    // 2. Commission Stats Aggregation (Filtered by restaurants on this page)
    // AdminCommission was already imported at the top, no need to re-import here.
    const commissionStats = await AdminCommission.aggregate([
      {
        $match: {
          ...commissionDateQuery,
          restaurantId: { $in: allRestaurantIdsForOrders },
          status: { $in: ['completed', 'settled'] } // Consider both completed and settled for commission
        }
      },
      {
        $group: {
          _id: "$restaurantId",
          totalCommission: { $sum: { $ifNull: ["$commissionAmount", 0] } },
          netEarnings: { $sum: { $ifNull: ["$restaurantEarning", 0] } }
        }
      }
    ]);

    // 3. User Experience/Rating Aggregation (Filtered by restaurants on this page)
    // FeedbackExperience was already imported at the top, no need to re-import here.
    const ratingStats = await FeedbackExperience.aggregate([
      {
        $match: {
          restaurantId: { $in: allRestaurantIdsForOrders },
          rating: { $exists: true, $ne: null, $gt: 0 }
        }
      },
      {
        $group: {
          _id: "$restaurantId",
          averageRating: { $avg: "$rating" },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    // Create maps for quick lookup
    const orderStatsMap = new Map();
    orderStats.forEach(stat => {
      // Calculate unique food items
      const uniqueItems = new Set();
      if (Array.isArray(stat.items)) {
        stat.items.forEach(orderItems => {
          if (Array.isArray(orderItems)) {
            orderItems.forEach(item => { if (item.itemId) uniqueItems.add(item.itemId.toString()); });
          }
        });
      }
      stat.totalFood = uniqueItems.size;
      orderStatsMap.set(stat._id.toString(), stat);
    });

    const commissionMap = new Map();
    commissionStats.forEach(stat => commissionMap.set(stat._id.toString(), stat));

    const ratingMap = new Map();
    ratingStats.forEach(stat => ratingMap.set(stat._id.toString(), stat));

    // Combine data
    const restaurantReports = restaurants.map((restaurant, index) => {
      const rId = restaurant._id.toString();
      const rIdField = restaurant.restaurantId;

      const oStats = orderStatsMap.get(rId) || orderStatsMap.get(rIdField) || {
        totalOrders: 0, totalAmount: 0, totalDiscount: 0, totalTax: 0, totalFood: 0
      };
      const cStats = commissionMap.get(rId) || commissionMap.get(rIdField) || { totalCommission: 0, netEarnings: 0 };
      const rStats = ratingMap.get(rId) || ratingMap.get(rIdField) || { averageRating: restaurant.rating || 0, totalRatings: restaurant.totalRatings || 0 };

      const formatCurrency = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      return {
        sl: skip + index + 1,
        id: rId,
        restaurantName: restaurant.name,
        restaurantId: restaurant.restaurantId,
        icon: restaurant.profileImage?.url || restaurant.profileImage || null,
        totalFood: oStats.totalFood,
        totalOrder: oStats.totalOrders,
        totalOrderAmount: formatCurrency(oStats.totalAmount),
        rawOrderAmount: oStats.totalAmount,
        totalDiscountGiven: formatCurrency(oStats.totalDiscount),
        rawDiscountGiven: oStats.totalDiscount,
        totalAdminCommission: formatCurrency(cStats.totalCommission),
        rawAdminCommission: cStats.totalCommission,
        totalVATTAX: formatCurrency(oStats.totalTax),
        rawVATTAX: oStats.totalTax,
        netEarnings: formatCurrency(cStats.netEarnings),
        rawNetEarnings: cStats.netEarnings,
        averageRatings: parseFloat((rStats.averageRating || 0).toFixed(1)),
        totalRatings: rStats.totalRatings || 0
      };
    });

    // Filter by type (Commission/Subscription) if needed
    let filteredReports = restaurantReports;
    if (type && type !== 'All types') {
      // This would require checking restaurant subscription status
      // For now, we'll return all restaurants
      // You can add subscription filtering logic here if needed
    }

    // Sort by restaurant name (already sorted by query, but re-sort if filteredReports changes)
    // filteredReports.sort((a, b) => a.restaurantName.localeCompare(b.restaurantName));

    // Add serial numbers (already done in map)
    // filteredReports = filteredReports.map((report, index) => ({
    //   ...report,
    //   sl: index + 1
    // }));

    return successResponse(res, 200, 'Restaurant report retrieved successfully', {
      restaurants: filteredReports,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalRestaurants,
        totalPages: Math.ceil(totalRestaurants / limitNum)
      }
    });
  } catch (error) {
    console.error('❌ Error fetching restaurant report:', error);
    console.error('Error stack:', error.stack);
    return errorResponse(res, 500, error.message || 'Failed to fetch restaurant report');
  }
});

/**
 * Get refund requests (restaurant cancelled orders with pending refunds)
 * GET /api/admin/refund-requests
 */
export const getRefundRequests = asyncHandler(async (req, res) => {
  try {
    console.log('✅ getRefundRequests route hit!');
    console.log('Request URL:', req.url);
    console.log('Request method:', req.method);
    console.log('Request query:', req.query);

    const {
      page = 1,
      limit = 50,
      search,
      fromDate,
      toDate,
      restaurant
    } = req.query;

    console.log('🔍 Fetching refund requests with params:', { page, limit, search, fromDate, toDate, restaurant });

    // Build query for restaurant cancelled orders with pending refunds
    const query = {
      status: 'cancelled',
      cancellationReason: {
        $regex: /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i
      }
    };

    console.log('📋 Initial query:', JSON.stringify(query, null, 2));

    // Restaurant filter
    if (restaurant && restaurant !== 'All restaurants') {
      try {
        const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
        const restaurantDoc = await Restaurant.findOne({
          $or: [
            { name: { $regex: restaurant, $options: 'i' } },
            ...(mongoose.Types.ObjectId.isValid(restaurant) ? [{ _id: restaurant }] : []),
            { restaurantId: restaurant }
          ]
        }).select('_id restaurantId').lean();

        if (restaurantDoc) {
          query.restaurantId = restaurantDoc._id?.toString() || restaurantDoc.restaurantId;
        }
      } catch (error) {
        console.error('Error filtering by restaurant:', error);
        // Continue without restaurant filter if there's an error
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      query.cancelledAt = {};
      if (fromDate) {
        const startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        query.cancelledAt.$gte = startDate;
      }
      if (toDate) {
        const endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
        query.cancelledAt.$lte = endDate;
      }
    }

    // Search filter - build search conditions separately
    const searchConditions = [];
    if (search) {
      searchConditions.push(
        { orderId: { $regex: search, $options: 'i' } },
        { restaurantName: { $regex: search, $options: 'i' } }
      );
    }

    // Combine search with existing query
    if (searchConditions.length > 0) {
      if (Object.keys(query).length > 0 && !query.$and) {
        // Convert existing query to $and format
        const existingQuery = { ...query };
        query = {
          $and: [
            existingQuery,
            { $or: searchConditions }
          ]
        };
      } else if (query.$and) {
        // Add search to existing $and
        query.$and.push({ $or: searchConditions });
      } else {
        // Simple case - just add $or
        query.$or = searchConditions;
      }
    }

    console.log('📋 Final query:', JSON.stringify(query, null, 2));

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders with population
    // Sort by cancelledAt if available, otherwise by createdAt
    let orders = [];
    try {
      orders = await Order.find(query)
        .populate('userId', 'name email phone')
        .populate({
          path: 'restaurantId',
          select: 'name slug',
          match: { _id: { $exists: true } } // Only populate if it's a valid ObjectId
        })
        .sort({ cancelledAt: -1, createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      // Filter out orders where restaurantId population failed (null)
      orders = orders.filter(order => order.restaurantId !== null || order.restaurantName);
    } catch (error) {
      console.error('Error fetching orders:', error);
      throw error;
    }

    const total = await Order.countDocuments(query);
    console.log(`✅ Found ${total} restaurant cancelled orders`);

    // Get settlement info for each order to check refund status
    let OrderSettlement;
    try {
      OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
    } catch (error) {
      console.error('Error importing OrderSettlement:', error);
      OrderSettlement = null;
    }

    const transformedOrders = await Promise.all(orders.map(async (order, index) => {
      let settlement = null;
      if (OrderSettlement) {
        try {
          settlement = await OrderSettlement.findOne({ orderId: order._id }).lean();
        } catch (error) {
          console.error(`Error fetching settlement for order ${order._id}:`, error);
        }
      }

      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      const customerPhone = order.userId?.phone || '';

      // Check refund status from settlement
      const refundStatus = settlement?.cancellationDetails?.refundStatus || 'pending';
      const refundAmount = settlement?.cancellationDetails?.refundAmount || 0;

      return {
        sl: skip + index + 1,
        orderId: order.orderId,
        id: order._id.toString(),
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: customerPhone,
        customerEmail: order.userId?.email || '',
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        restaurantId: order.restaurantId?.toString() || order.restaurantId || '',
        totalAmount: order.pricing?.total || 0,
        paymentStatus: order.payment?.status === 'completed' ? 'Paid' : 'Pending',
        orderStatus: 'Refund Requested',
        deliveryType: order.deliveryFleet === 'standard' ? 'Home Delivery' : 'Fast Delivery',
        cancellationReason: order.cancellationReason || 'Rejected by restaurant',
        cancelledAt: order.cancelledAt,
        refundStatus: refundStatus,
        refundAmount: refundAmount,
        settlement: settlement ? {
          cancellationStage: settlement.cancellationDetails?.cancellationStage,
          refundAmount: settlement.cancellationDetails?.refundAmount,
          restaurantCompensation: settlement.cancellationDetails?.restaurantCompensation
        } : null
      };
    }));

    console.log(`✅ Returning ${transformedOrders.length} refund requests`);

    return successResponse(res, 200, 'Refund requests retrieved successfully', {
      orders: transformedOrders || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: Math.ceil((total || 0) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching refund requests:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    return errorResponse(res, 500, error.message || 'Failed to fetch refund requests');
  }
});

/**
 * Process refund for an order via Razorpay
 * POST /api/admin/orders/:orderId/refund
 */
export const processRefund = asyncHandler(async (req, res) => {
  try {
    console.log('🔍 [processRefund] ========== ROUTE HIT ==========');
    console.log('🔍 [processRefund] Method:', req.method);
    console.log('🔍 [processRefund] URL:', req.url);
    console.log('🔍 [processRefund] Original URL:', req.originalUrl);
    console.log('🔍 [processRefund] Path:', req.path);
    console.log('🔍 [processRefund] Base URL:', req.baseUrl);
    console.log('🔍 [processRefund] Params:', req.params);
    console.log('🔍 [processRefund] Headers:', {
      authorization: req.headers.authorization ? 'Present' : 'Missing',
      'content-type': req.headers['content-type']
    });

    const { orderId } = req.params;
    const { notes, refundAmount } = req.body;
    const adminId = req.user?.id || req.admin?.id || null;

    console.log('🔍 [processRefund] Processing refund request:', {
      orderId,
      orderIdType: typeof orderId,
      orderIdLength: orderId?.length,
      isObjectId: mongoose.Types.ObjectId.isValid(orderId),
      adminId,
      url: req.url,
      method: req.method,
      params: req.params,
      body: req.body,
      refundAmount: refundAmount,
      refundAmountType: typeof refundAmount,
      notes: notes
    });

    // Find order in database - try both MongoDB _id and orderId string
    let order = null;

    console.log('🔍 [processRefund] Searching order in database...', {
      searchId: orderId,
      isObjectId: mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24
    });

    // First try MongoDB _id if it's a valid ObjectId
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      console.log('🔍 [processRefund] Searching by MongoDB _id:', orderId);
      order = await Order.findById(orderId)
        .populate('userId', 'name email phone _id')
        .lean();
      console.log('🔍 [processRefund] Order found by _id:', order ? 'Yes' : 'No');
    }

    // If not found by _id, try orderId string
    if (!order) {
      console.log('🔍 [processRefund] Searching by orderId string:', orderId);
      order = await Order.findOne({ orderId: orderId })
        .populate('userId', 'name email phone _id')
        .lean();
      console.log('🔍 [processRefund] Order found by orderId:', order ? 'Yes' : 'No');
    }

    if (!order) {
      console.error('❌ [processRefund] Order NOT FOUND in database');
      console.error('❌ [processRefund] Searched by:', {
        mongoId: mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24 ? orderId : 'N/A',
        orderIdString: orderId,
        orderIdType: typeof orderId,
        orderIdLength: orderId?.length
      });

      // Try to find any order with similar orderId (for debugging)
      try {
        const similarOrders = await Order.find({
          $or: [
            { orderId: { $regex: orderId, $options: 'i' } },
            { orderId: { $regex: orderId.substring(0, 10), $options: 'i' } }
          ]
        })
          .select('_id orderId status')
          .limit(5)
          .lean();

        if (similarOrders.length > 0) {
          console.log('💡 [processRefund] Found similar orders:', similarOrders.map(o => ({
            mongoId: o._id.toString(),
            orderId: o.orderId,
            status: o.status
          })));
        }
      } catch (debugError) {
        console.error('Error searching for similar orders:', debugError.message);
      }

      // Check total orders count
      try {
        const totalOrders = await Order.countDocuments();
        console.log(`📊 [processRefund] Total orders in database: ${totalOrders}`);
      } catch (countError) {
        console.error('Error counting orders:', countError.message);
      }

      return errorResponse(res, 404, `Order not found (ID: ${orderId}). Please check if the order exists.`);
    }

    // Verify order exists and log complete details
    console.log('✅✅✅ [processRefund] ORDER FOUND IN DATABASE ✅✅✅');
    console.log('📋 [processRefund] Complete Order Details:', {
      mongoId: order._id.toString(),
      orderId: order.orderId,
      status: order.status,
      paymentMethod: order.payment?.method || 'unknown',
      paymentType: order.paymentType || 'unknown',
      total: order.pricing?.total || 0,
      cancelledBy: order.cancelledBy || 'unknown',
      userId: order.userId?._id?.toString() || order.userId?.toString() || 'unknown',
      userName: order.userId?.name || 'unknown',
      userPhone: order.userId?.phone || 'unknown'
    });

    if (order.status !== 'cancelled') {
      return errorResponse(res, 400, 'Order is not cancelled');
    }

    // Check if it's a cancelled order (by restaurant or user)
    const isRestaurantCancelled = order.cancelledBy === 'restaurant' ||
      (order.cancellationReason &&
        /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue/i.test(order.cancellationReason));

    const isUserCancelled = order.cancelledBy === 'user';

    if (!isRestaurantCancelled && !isUserCancelled) {
      return errorResponse(res, 400, 'This order was not cancelled by restaurant or user');
    }

    // Check payment method - wallet payments don't use Razorpay
    const paymentMethod = order.payment?.method;

    if (!paymentMethod) {
      return errorResponse(res, 400, 'Payment method not found for this order');
    }

    // For wallet payments, allow refund regardless of delivery type (no Razorpay involved)
    // For other payments (Razorpay), only allow refund for Home Delivery orders
    // Note: Order model uses deliveryFleet, not deliveryType
    if (paymentMethod !== 'wallet') {
      // Check deliveryFleet - 'standard' and 'fast' are home delivery types
      const isHomeDelivery = order.deliveryFleet === 'standard' || order.deliveryFleet === 'fast';
      if (!isHomeDelivery) {
        return errorResponse(res, 400, 'Refund can only be processed for Home Delivery orders');
      }
    }

    // Get settlement (for wallet payments, settlement might not exist - create one if needed)
    const OrderSettlement = (await import('../../order/models/OrderSettlement.js')).default;
    let settlement = await OrderSettlement.findOne({ orderId: order._id });

    // For wallet payments, if settlement doesn't exist, create a proper one with all required fields
    if (!settlement && paymentMethod === 'wallet') {
      console.log('📝 [processRefund] Settlement not found for wallet order, creating settlement with order data...');

      const pricing = order.pricing || {};
      const subtotal = pricing.subtotal || 0;
      const deliveryFee = pricing.deliveryFee || 0;
      const platformFee = pricing.platformFee || 0;
      const tax = pricing.tax || 0;
      const total = pricing.total || 0;

      // Calculate earnings (simplified for wallet refunds - we just need the structure)
      const foodPrice = subtotal;
      const commission = 0; // For wallet refunds, we don't need actual commission
      const netEarning = foodPrice; // Simplified

      settlement = new OrderSettlement({
        orderId: order._id,
        orderNumber: order.orderId,
        userId: order.userId?._id || order.userId,
        restaurantId: order.restaurantId,
        restaurantName: order.restaurantName || 'Unknown Restaurant',
        userPayment: {
          subtotal: subtotal,
          discount: pricing.discount || 0,
          deliveryFee: deliveryFee,
          platformFee: platformFee,
          gst: tax,
          packagingFee: 0,
          total: total
        },
        restaurantEarning: {
          foodPrice: foodPrice,
          commission: commission,
          commissionPercentage: 0,
          netEarning: netEarning,
          status: 'cancelled'
        },
        deliveryPartnerEarning: {
          basePayout: 0,
          distance: 0,
          commissionPerKm: 0,
          distanceCommission: 0,
          surgeMultiplier: 1,
          surgeAmount: 0,
          totalEarning: 0,
          status: 'cancelled'
        },
        adminEarning: {
          commission: commission,
          platformFee: platformFee,
          deliveryFee: deliveryFee,
          gst: tax,
          deliveryMargin: 0,
          totalEarning: platformFee + deliveryFee + tax,
          status: 'cancelled'
        },
        escrowStatus: 'refunded',
        escrowAmount: total,
        settlementStatus: 'cancelled',
        cancellationDetails: {
          cancelled: true,
          cancelledAt: order.updatedAt || new Date(),
          refundStatus: 'pending'
        }
      });
      await settlement.save();
      console.log('✅ [processRefund] Settlement created for wallet refund');
    } else if (!settlement) {
      // For non-wallet payments, settlement is required
      return errorResponse(res, 404, 'Settlement not found for this order');
    }

    // Check if refund already processed
    if (settlement.cancellationDetails?.refundStatus === 'processed' ||
      settlement.cancellationDetails?.refundStatus === 'initiated') {
      return errorResponse(res, 400, 'Refund already processed or initiated for this order');
    }

    // Handle wallet refunds differently (paymentMethod already declared above)
    // Wallet payments don't use Razorpay - refund is direct wallet credit
    let refundResult;
    // Calculate refund amount - priority: 1. Request Body, 2. Settlement Calculation, 3. Wallet Order Total
    const orderTotal = order.pricing?.total || settlement?.userPayment?.total || 0;
    let finalRefundAmount = 0;

    if (refundAmount !== undefined && refundAmount !== null && refundAmount !== '') {
      const requestedAmount = parseFloat(refundAmount);
      if (isNaN(requestedAmount) || requestedAmount <= 0) {
        return errorResponse(res, 400, `Invalid refund amount provided: ${refundAmount}. Please provide a valid positive number.`);
      }
      if (requestedAmount > (orderTotal + 0.01)) { // Allow minor rounding difference
        return errorResponse(res, 400, `Refund amount (₹${requestedAmount}) cannot exceed order total (₹${orderTotal})`);
      }
      finalRefundAmount = requestedAmount;
    } else if (settlement?.cancellationDetails?.refundAmount > 0) {
      finalRefundAmount = settlement.cancellationDetails.refundAmount;
    } else if (paymentMethod === 'wallet' && orderTotal > 0) {
      finalRefundAmount = orderTotal;
    }

    if (finalRefundAmount <= 0) {
      return errorResponse(res, 400, 'No refund amount found or calculated for this order');
    }

    // Update settlement with refund amount if it changed
    if (settlement && settlement.cancellationDetails) {
      settlement.cancellationDetails.refundAmount = finalRefundAmount;
      await settlement.save();
    }

    if (paymentMethod === 'wallet') {
      // Process wallet refund (add to user wallet)
      const { processWalletRefund } = await import('../../order/services/cancellationRefundService.js');
      refundResult = await processWalletRefund(order._id, adminId, finalRefundAmount);
    } else {
      // Process Razorpay refund
      const { processRazorpayRefund } = await import('../../order/services/cancellationRefundService.js');
      refundResult = await processRazorpayRefund(order._id, adminId, finalRefundAmount);
    }

    // Update settlement with admin notes if provided
    if (notes && settlement && settlement.cancellationDetails) {
      settlement.cancellationDetails.adminNotes = notes;

      // Also keep in metadata for backward compatibility
      settlement.metadata = settlement.metadata || new Map();
      settlement.metadata.set('adminRefundNotes', notes);

      await settlement.save();
    }

    return successResponse(res, 200, refundResult.message || 'Refund processed successfully', {
      orderId: order.orderId,
      refundId: refundResult.refundId,
      refundAmount: refundResult.refundAmount,
      razorpayRefund: refundResult.razorpayRefund,
      message: refundResult.message
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    return errorResponse(res, 500, error.message || 'Failed to process refund');
  }
});

/**
 * Get orders for assignment (showing restaurant acceptance status)
 * GET /api/admin/orders/for-assignment
 * Query params: page, limit, search, restaurantAccepted (true/false)
 */
export const getOrdersForAssignment = asyncHandler(async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search,
      restaurantAccepted
    } = req.query;

    // Build query - exclude pending (unpaid), cancelled, and delivered orders
    const query = {
      status: { $nin: ['pending', 'cancelled', 'delivered'] }
    };

    // Filter by restaurant acceptance status
    if (restaurantAccepted === 'true') {
      // 'preparing' or 'ready' status means restaurant has accepted
      query.status = { $in: ['preparing', 'ready'] };
    } else if (restaurantAccepted === 'false') {
      // 'confirmed' status means order is paid/confirmed but not yet accepted by restaurant
      query.status = 'confirmed';
    }

    // Search filter
    if (search) {
      const searchOrConditions = [
        { orderId: { $regex: search, $options: 'i' } }
      ];

      // If search looks like a phone number, search in customer data
      const phoneRegex = /[\d\s\+\-()]+/;
      if (phoneRegex.test(search)) {
        const User = (await import('../../auth/models/User.js')).default;
        const cleanSearch = search.replace(/\D/g, '');
        const userSearchQuery = { phone: { $regex: cleanSearch, $options: 'i' } };
        if (mongoose.Types.ObjectId.isValid(search)) {
          userSearchQuery._id = search;
        }
        const users = await User.find(userSearchQuery).select('_id').lean();
        const userIds = users.map(u => u._id);
        if (userIds.length > 0) {
          searchOrConditions.push({ userId: { $in: userIds } });
        }
      }

      // Also search by customer name
      const User = (await import('../../auth/models/User.js')).default;
      const usersByName = await User.find({
        name: { $regex: search, $options: 'i' }
      }).select('_id').lean();
      const userIdsByName = usersByName.map(u => u._id);
      if (userIdsByName.length > 0) {
        searchOrConditions.push({ userId: { $in: userIdsByName } });
      }

      if (searchOrConditions.length > 0) {
        query.$and = query.$and || [];
        query.$and.push({ $or: searchOrConditions });
      }
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get total count
    const total = await Order.countDocuments(query);

    // Fetch orders with population
    const orders = await Order.find(query)
      .populate('userId', 'name email phone')
      .populate('deliveryPartnerId', 'name phone')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    // Get unique restaurant IDs
    const restaurantIds = [...new Set(orders.map(o => o.restaurantId).filter(Boolean))];

    // Fetch restaurant data with location
    const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
    const restaurants = await Restaurant.find({
      $or: [
        { _id: { $in: restaurantIds } },
        { restaurantId: { $in: restaurantIds } }
      ]
    }).select('_id restaurantId name slug location').lean();

    // Create a map for quick lookup
    const restaurantMap = new Map();
    restaurants.forEach(rest => {
      const id = rest._id?.toString() || rest.restaurantId;
      restaurantMap.set(id, rest);
      if (rest.restaurantId) restaurantMap.set(rest.restaurantId, rest);
      if (rest._id) restaurantMap.set(rest._id.toString(), rest);
    });

    // Transform orders
    const transformedOrders = orders.map((order, index) => {
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      const timeStr = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }).toUpperCase();

      // Check if restaurant has accepted (status is 'preparing', 'ready', or 'out_for_delivery')
      const isRestaurantAccepted = ['preparing', 'ready', 'out_for_delivery'].includes(order.status);

      // Check delivery boy acceptance status
      const deliveryStateStatus = order.deliveryState?.status || 'pending';
      const isDeliveryBoyAccepted = deliveryStateStatus === 'accepted';
      const isDeliveryBoyPending = order.deliveryPartnerId && deliveryStateStatus === 'pending';

      // Admin can always reassign if a partner is already assigned
      const canReassign = !!order.deliveryPartnerId;

      // Get restaurant zone and location info
      const restaurantZoneName = order.assignmentInfo?.zoneName || null;

      // Get restaurant data from map
      const restaurantData = restaurantMap.get(order.restaurantId) || null;
      const restaurantLocation = restaurantData?.location || null;

      return {
        id: order._id.toString(),
        orderId: order.orderId,
        sl: skip + index + 1,
        date: dateStr,
        time: timeStr,
        customerName: order.userId?.name || 'Unknown',
        customerPhone: order.userId?.phone || '',
        customerEmail: order.userId?.email || '',
        restaurant: order.restaurantName || order.restaurantId?.name || 'Unknown Restaurant',
        restaurantId: order.restaurantId?._id?.toString() || order.restaurantId?.toString() || order.restaurantId || '',
        restaurantZoneName: restaurantZoneName,
        restaurantLocation: restaurantLocation,
        totalAmount: order.pricing?.total || 0,
        orderStatus: order.status,
        restaurantAccepted: isRestaurantAccepted,
        items: order.items || [],
        address: order.address || {},
        deliveryAddressDetails: order.deliveryAddressDetails || '',
        note: order.note || '',
        paymentMethod: order.payment?.method || 'unknown',
        deliveryPartnerName: order.deliveryPartnerId?.name || null,
        deliveryPartnerId: order.deliveryPartnerId?._id?.toString() || order.deliveryPartnerId?.toString() || null,
        isAssigned: !!order.deliveryPartnerId,
        deliveryStateStatus: deliveryStateStatus,
        isDeliveryBoyAccepted: isDeliveryBoyAccepted,
        isDeliveryBoyPending: isDeliveryBoyPending,
        canReassign: canReassign,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    });

    return successResponse(res, 200, 'Orders for assignment retrieved successfully', {
      orders: transformedOrders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching orders for assignment:', error);
    return errorResponse(res, 500, 'Failed to fetch orders for assignment');
  }
});

/**
 * Assign order to delivery boy
 * POST /api/admin/orders/:orderId/assign
 */
export const assignOrderToDeliveryBoy = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliveryBoyId } = req.body;

    console.log('📦 Assigning order:', { orderId, deliveryBoyId });

    if (!deliveryBoyId) {
      return errorResponse(res, 400, 'Delivery boy ID is required');
    }

    // Validate deliveryBoyId format
    if (!mongoose.Types.ObjectId.isValid(deliveryBoyId)) {
      return errorResponse(res, 400, 'Invalid delivery boy ID format');
    }

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Allow reassignment if a delivery partner is already assigned
    const canReassign = !!order.deliveryPartnerId;

    if (order.deliveryPartnerId && !canReassign) {
      // This block will practically never be hit now, but kept for logic safety
      return errorResponse(res, 400, 'Order already has a delivery partner assigned. Cannot reassign.');
    }

    // If reassigning, clear the old assignment and denied list first
    if (canReassign) {
      console.log(`🔄 Reassigning order ${order.orderId} from delivery partner ${order.deliveryPartnerId} to ${deliveryBoyId}`);
      order.deliveryPartnerId = null;
      order.deliveryState = {
        status: 'pending',
        currentPhase: 'assigned'
      };
      // Clear denied list when reassigning so the new delivery boy can be notified
      order.deniedDeliveryPartners = [];
      console.log(`🔄 Cleared denied delivery partners list for reassignment`);
    }

    // Check if order is cancelled or delivered
    if (order.status === 'cancelled' || order.status === 'delivered') {
      return errorResponse(res, 400, 'Cannot assign delivery boy to cancelled or delivered order');
    }

    // Find delivery boy
    const Delivery = (await import('../../delivery/models/Delivery.js')).default;
    const deliveryBoy = await Delivery.findById(deliveryBoyId);

    if (!deliveryBoy) {
      return errorResponse(res, 404, 'Delivery boy not found');
    }

    // Check if delivery boy is active and approved
    if (deliveryBoy.status !== 'approved' && deliveryBoy.status !== 'active') {
      return errorResponse(res, 400, 'Delivery boy is not approved or active');
    }

    if (!deliveryBoy.isActive) {
      return errorResponse(res, 400, 'Delivery boy is not active');
    }

    // Assign delivery boy to order (Mongoose will handle ObjectId conversion)
    order.deliveryPartnerId = deliveryBoyId;
    order.assignmentInfo = {
      ...(order.assignmentInfo || {}),
      assignedBy: 'manual', // Enum value: 'zone_match', 'nearest_distance', 'manual', 'nearest_available', 'delivery_accept'
      assignedAt: new Date(),
      assignmentMethod: 'admin_manual',
      assignedByAdmin: req.user?._id?.toString() || req.admin?._id?.toString() || null // Store admin ID separately if needed
    };

    // Save order status first
    try {
      await order.save();
      console.log(`✅ Order ${order.orderId} assigned to delivery boy ${deliveryBoyId}`);
    } catch (saveError) {
      console.error('Error saving order:', saveError);
      return errorResponse(res, 500, `Failed to save order: ${saveError.message}`);
    }

    // --- FIREBASE ASSIGNMENT SYNC ---
    try {
      const { generateRoutePolyline } = await import('../../delivery/services/locationProcessingService.js');
      const { syncActiveOrderToFirebase } = await import('../../../shared/services/firebaseAdmin.js');

      // Get restaurant info
      const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
      const restaurant = await Restaurant.findById(order.restaurantId).lean();

      const restLat = restaurant?.location?.coordinates?.[1] || restaurant?.location?.latitude;
      const restLng = restaurant?.location?.coordinates?.[0] || restaurant?.location?.longitude;
      const custLat = order.address?.lat || order.address?.latitude;
      const custLng = order.address?.lng || order.address?.longitude;

      if (restLat && restLng && custLat && custLng) {
        // Generate/Fetch polyline (this will check Firebase cache automatically)
        const route = await generateRoutePolyline(
          { lat: restLat, lng: restLng },
          null,
          { lat: custLat, lng: custLng }
        );

        await syncActiveOrderToFirebase(order.orderId, {
          boy_id: deliveryBoyId.toString(),
          boy_lat: restLat,
          boy_lng: restLng,
          created_at: Date.now(),
          customer_lat: custLat,
          customer_lng: custLng,
          restaurant_lat: restLat,
          restaurant_lng: restLng,
          status: 'assigned',
          polyline: route?.polyline || null,
          distance: route?.totalDistance || 0,
          duration: route?.duration ? (route.duration / 60) : 0 // in minutes
        });
        console.log(`✅ Order ${order.orderId} tracking initialized in Firebase`);
      }
    } catch (fbError) {
      console.warn('⚠️ Failed to sync assignment to Firebase:', fbError.message);
    }

    // Notify delivery boy about the assigned order (non-blocking)
    // This runs asynchronously and won't block the response
    (async () => {
      try {
        const { notifyDeliveryBoyNewOrder } = await import('../../order/services/deliveryNotificationService.js');
        // Get order with populated user (restaurantId is a string, not ObjectId, so don't populate it)
        const populatedOrder = await Order.findById(order._id)
          .populate('userId', 'name phone')
          .lean();

        // Add restaurant info manually since restaurantId is a string
        if (populatedOrder && populatedOrder.restaurantId) {
          try {
            const Restaurant = (await import('../../restaurant/models/Restaurant.js')).default;
            const restaurant = await Restaurant.findById(populatedOrder.restaurantId)
              .select('name address location.address location.formattedAddress location.coordinates phone ownerPhone')
              .lean();
            if (restaurant) {
              // Set restaurant data properly
              populatedOrder.restaurantId = restaurant;
              populatedOrder.restaurantName = restaurant.name || populatedOrder.restaurantName;
              populatedOrder.restaurantAddress = restaurant.location?.formattedAddress ||
                restaurant.location?.address ||
                restaurant.address ||
                'Restaurant address';
              // Ensure restaurant location is properly set for notification service
              if (restaurant.location && !restaurant.location.coordinates && restaurant.location.latitude && restaurant.location.longitude) {
                restaurant.location.coordinates = [restaurant.location.longitude, restaurant.location.latitude];
              }
              console.log('📍 Restaurant data for notification:', {
                name: restaurant.name,
                address: populatedOrder.restaurantAddress,
                hasLocation: !!restaurant.location,
                coordinates: restaurant.location?.coordinates
              });
            }
          } catch (restaurantError) {
            console.error('Error fetching restaurant for notification:', restaurantError);
            // Continue without restaurant data
          }
        }

        if (populatedOrder) {
          await notifyDeliveryBoyNewOrder(populatedOrder, deliveryBoyId);
          console.log(`✅ Notified delivery boy ${deliveryBoyId} about assigned order ${order.orderId}`);
        }
      } catch (notifError) {
        console.error('Error notifying delivery boy:', notifError);
        console.error('Notification error stack:', notifError.stack);
        // Don't fail the assignment if notification fails
      }
    })();

    return successResponse(res, 200, 'Order assigned to delivery boy successfully', {
      order: {
        _id: order._id.toString(),
        orderId: order.orderId,
        deliveryPartnerId: order.deliveryPartnerId.toString()
      }
    });
  } catch (error) {
    console.error('❌ Error assigning order to delivery boy:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    return errorResponse(res, 500, `Failed to assign order to delivery boy: ${error.message || 'Unknown error'}`);
  }
});

/**
 * Get all delivery boys for assignment dropdown
 * GET /api/admin/delivery-boys/for-assignment
 */
export const getDeliveryBoysForAssignment = asyncHandler(async (req, res) => {
  try {
    const Delivery = (await import('../../delivery/models/Delivery.js')).default;
    const DeliveryWallet = (await import('../../delivery/models/DeliveryWallet.js')).default;
    const BusinessSettings = (await import('../models/BusinessSettings.js')).default;

    // Get all approved and active delivery boys
    const deliveryBoys = await Delivery.find({
      status: { $in: ['approved', 'active'] },
      isActive: true
    })
      .select('_id name phone availability.isOnline')
      .sort({ name: 1 })
      .lean();

    // Get cash limit from business settings
    let totalCashLimit = 750; // Default value
    try {
      const settings = await BusinessSettings.getSettings();
      // Check if deliveryCashLimit exists and is a valid number
      if (settings?.deliveryCashLimit !== undefined && settings?.deliveryCashLimit !== null) {
        const configured = Number(settings.deliveryCashLimit);
        if (Number.isFinite(configured) && configured >= 0) {
          totalCashLimit = configured;
        }
      }
      // If not set or invalid, use default 750
      console.log('💰 Cash Limit for assignment:', {
        settingsValue: settings?.deliveryCashLimit,
        totalCashLimit
      });
    } catch (e) {
      console.error('Error fetching cash limit from settings:', e);
      // Keep default value of 750
      totalCashLimit = 750;
    }

    // Get wallet data for all delivery boys
    const deliveryIds = deliveryBoys.map(db => db._id);
    const wallets = await DeliveryWallet.find({
      deliveryId: { $in: deliveryIds }
    }).lean();

    // Create a map for quick wallet lookup
    const walletMap = new Map();
    wallets.forEach(wallet => {
      const deliveryId = wallet.deliveryId?.toString();
      if (deliveryId) {
        walletMap.set(deliveryId, wallet);
      }
    });

    // Transform for dropdown with wallet info
    const transformedDeliveryBoys = deliveryBoys.map(db => {
      const dbId = db._id.toString();
      const wallet = walletMap.get(dbId);
      const cashInHand = Math.max(0, Number(wallet?.cashInHand) || 0);
      const availableCashLimit = Math.max(0, totalCashLimit - cashInHand);

      return {
        _id: dbId,
        id: dbId,
        name: db.name,
        phone: db.phone,
        isOnline: db.availability?.isOnline || false,
        cashInHand: cashInHand,
        totalCashLimit: totalCashLimit,
        availableCashLimit: availableCashLimit
      };
    });

    return successResponse(res, 200, 'Delivery boys retrieved successfully', {
      deliveryBoys: transformedDeliveryBoys
    });
  } catch (error) {
    console.error('Error fetching delivery boys for assignment:', error);
    return errorResponse(res, 500, 'Failed to fetch delivery boys');
  }
});

/**
 * Accept order on behalf of restaurant
 * POST /api/admin/orders/:orderId/accept-restaurant
 */
export const acceptOrderOnBehalfOfRestaurant = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Allow accepting orders with status 'pending' or 'confirmed'
    if (!['pending', 'confirmed'].includes(order.status)) {
      return errorResponse(res, 400, `Order cannot be accepted. Current status: ${order.status}`);
    }

    // When admin accepts order on behalf of restaurant, set status to 'preparing'
    if (order.status === 'pending') {
      order.tracking.confirmed = { status: true, timestamp: new Date() };
    }

    // Set status to 'preparing' when order is accepted
    order.status = 'preparing';
    order.tracking.preparing = { status: true, timestamp: new Date() };

    // Mark as accepted by admin
    order.acceptedByAdmin = true;
    order.acceptedByAdminAt = new Date();
    order.acceptedByAdminId = req.user?._id?.toString() || req.admin?._id?.toString() || null;

    // Handle payment status for offline payments
    const paymentMethod = order.payment?.method;
    const isOfflinePayment = paymentMethod && !['razorpay', 'cash', 'wallet'].includes(paymentMethod);

    if (isOfflinePayment && order.payment.status === 'pending') {
      order.payment.status = 'completed';

      // Also update the Payment record if it exists
      try {
        const Payment = (await import('../../payment/models/Payment.js')).default;
        const paymentRecord = await Payment.findOne({ orderId: order._id });
        if (paymentRecord) {
          paymentRecord.status = 'completed';
          paymentRecord.completedAt = new Date();
          paymentRecord.logs.push({
            action: 'completed',
            timestamp: new Date(),
            details: {
              previousStatus: 'pending',
              newStatus: 'completed',
              note: 'Payment marked as completed by admin during order acceptance'
            }
          });
          await paymentRecord.save();
        }
      } catch (paymentError) {
        console.warn('⚠️ Failed to update Payment record:', paymentError.message);
      }
    }

    await order.save();

    // Trigger ETA recalculation for restaurant accepted event
    try {
      const etaEventService = (await import('../../order/services/etaEventService.js')).default;
      await etaEventService.handleRestaurantAccepted(order._id.toString(), new Date());
      console.log(`✅ ETA updated after admin accepted order ${order.orderId} on behalf of restaurant`);
    } catch (etaError) {
      console.error('Error updating ETA after admin accept:', etaError);
    }

    // Notify restaurant about order acceptance via Socket.IO
    try {
      const { notifyRestaurantOrderUpdate } = await import('../../order/services/restaurantNotificationService.js');
      await notifyRestaurantOrderUpdate(order._id.toString(), 'preparing');
      console.log(`✅ Sent order status update notification to restaurant ${order.restaurantId} - order ${order.orderId} is now preparing`);
    } catch (notifError) {
      console.error('Error sending notification:', notifError);
    }

    return successResponse(res, 200, 'Order accepted successfully on behalf of restaurant', {
      order
    });
  } catch (error) {
    console.error('Error accepting order on behalf of restaurant:', error);
    return errorResponse(res, 500, 'Failed to accept order');
  }
});

/**
 * Reject order on behalf of restaurant
 * POST /api/admin/orders/:orderId/reject-restaurant
 */
export const rejectOrderOnBehalfOfRestaurant = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason = 'Rejected by Admin' } = req.body;

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.status)) {
      return errorResponse(res, 400, `Cannot reject order. Current status: ${order.status}`);
    }

    // Set status to cancelled
    order.status = 'cancelled';
    order.cancellationReason = reason;
    order.cancelledBy = 'restaurant'; // Treat as restaurant (admin acting on behalf)
    order.cancelledAt = new Date();

    // Add admin metadata
    order.assignmentInfo = {
      ...(order.assignmentInfo || {}),
      rejectedByAdmin: req.user?._id?.toString() || req.admin?._id?.toString() || null,
      rejectedByAdminAt: new Date()
    };

    await order.save();

    // Handle refunds for online payments
    const paymentMethod = order.payment?.method;
    if (paymentMethod === 'razorpay' || paymentMethod === 'wallet') {
      try {
        const { calculateCancellationRefund } = await import('../../order/services/cancellationRefundService.js');
        await calculateCancellationRefund(order._id, reason);
        console.log(`✅ Cancellation refund calculated for admin rejected order ${order.orderId}`);
      } catch (refundError) {
        console.error('Error calculating refund:', refundError);
      }
    }

    // Notify User
    try {
      const { notifyUserOrderUpdate } = await import('../../order/services/userNotificationService.js');
      await notifyUserOrderUpdate(order._id, 'cancelled');
    } catch (e) {
      console.error('Error notifying user:', e);
    }

    // Notify Restaurant
    try {
      const { notifyRestaurantOrderUpdate } = await import('../../order/services/restaurantNotificationService.js');
      await notifyRestaurantOrderUpdate(order._id.toString(), 'cancelled');
    } catch (restNotifError) {
      console.error('Error notifying restaurant:', restNotifError);
    }

    return successResponse(res, 200, 'Order rejected successfully on behalf of restaurant', {
      order
    });
  } catch (error) {
    console.error('Error rejecting order on behalf of restaurant:', error);
    return errorResponse(res, 500, 'Failed to reject order');
  }
});

/**
 * Reassign order to same restaurant (resend notification)
 * POST /api/admin/orders/:orderId/reassign-restaurant
 */
/**
 * Delete order by ID
 * DELETE /api/admin/orders/:id
 */
export const deleteOrder = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.id || req.admin?.id || null;

    console.log('🗑️ [deleteOrder] Deleting order:', {
      id,
      idType: typeof id,
      isObjectId: mongoose.Types.ObjectId.isValid(id),
      adminId
    });

    // Find order - try both MongoDB _id and orderId string
    let order = null;

    if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      order = await Order.findById(id);
    }

    if (!order) {
      order = await Order.findOne({ orderId: id });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if order can be deleted (optional: add business logic here)
    // For example, don't allow deleting orders that are in certain statuses
    const restrictedStatuses = ['out_for_delivery', 'delivered'];
    if (restrictedStatuses.includes(order.status)) {
      return errorResponse(res, 400, `Cannot delete order with status: ${order.status}. Order is already ${order.status}.`);
    }

    // Delete the order
    await Order.findByIdAndDelete(order._id);

    console.log(`✅ [deleteOrder] Order deleted successfully: ${order.orderId} (${order._id})`);

    return successResponse(res, 200, 'Order deleted successfully', {
      orderId: order.orderId,
      deletedAt: new Date()
    });
  } catch (error) {
    console.error('❌ [deleteOrder] Error deleting order:', error);
    return errorResponse(res, 500, `Failed to delete order: ${error.message}`);
  }
});

export const reassignOrderToRestaurant = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId).populate('restaurantId', 'name location address phone ownerPhone');
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId }).populate('restaurantId', 'name location address phone ownerPhone');
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if order is in valid status for reassignment
    if (['cancelled', 'delivered'].includes(order.status)) {
      return errorResponse(res, 400, `Cannot reassign order. Current status: ${order.status}`);
    }

    const restaurantId = order.restaurantId?._id?.toString() || order.restaurantId?.toString();

    if (!restaurantId) {
      return errorResponse(res, 400, 'Restaurant ID not found in order');
    }

    // Resend notification to restaurant
    try {
      const { notifyRestaurantNewOrder } = await import('../../order/services/restaurantNotificationService.js');
      await notifyRestaurantNewOrder(order, restaurantId);
      console.log(`✅ Resent notification to restaurant ${restaurantId} for order ${order.orderId}`);
    } catch (notifError) {
      console.error('Error resending notification to restaurant:', notifError);
      return errorResponse(res, 500, 'Failed to resend notification to restaurant');
    }

    // Update order metadata
    order.reassignedByAdmin = true;
    order.reassignedByAdminAt = new Date();
    order.reassignedByAdminId = req.user?._id?.toString() || req.admin?._id?.toString() || null;

    await order.save();

    return successResponse(res, 200, 'Order reassigned to restaurant successfully. Notification sent.', {
      order
    });
  } catch (error) {
    console.error('Error reassigning order to restaurant:', error);
    return errorResponse(res, 500, 'Failed to reassign order');
  }
});

/**
 * Accept order on behalf of delivery boy
 * POST /api/admin/orders/:orderId/accept-delivery-boy
 */
export const acceptOrderOnBehalfOfDeliveryBoy = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if delivery partner is assigned
    if (!order.deliveryPartnerId) {
      return errorResponse(res, 400, 'No delivery partner assigned to this order');
    }

    // Update delivery state
    if (!order.deliveryState) {
      order.deliveryState = {};
    }
    order.deliveryState.status = 'accepted';
    order.deliveryState.acceptedAt = new Date();
    // Valid currentPhase values: ['assigned', 'en_route_to_pickup', 'at_pickup', 'en_route_to_delivery', 'at_delivery', 'completed']
    // When accepted, it's typically 'en_route_to_pickup' or remains 'assigned' until they start moving
    order.deliveryState.currentPhase = 'assigned';

    // Mark as accepted by admin (for audit)
    order.assignmentInfo = {
      ...order.assignmentInfo,
      assignedBy: 'manual',
      acceptedByAdmin: true,
      acceptedByAdminAt: new Date(),
      acceptedByAdminId: req.user?._id?.toString() || req.admin?._id?.toString() || null
    };

    await order.save();

    return successResponse(res, 200, 'Order accepted successfully on behalf of delivery boy', {
      order
    });
  } catch (error) {
    console.error('Error accepting order on behalf of delivery boy:', error);
    return errorResponse(res, 500, 'Failed to accept order on behalf of delivery boy');
  }
});

/**
 * Reject order on behalf of delivery boy
 * POST /api/admin/orders/:orderId/reject-delivery-boy
 */
export const rejectOrderOnBehalfOfDeliveryBoy = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    if (!order.deliveryPartnerId) {
      return errorResponse(res, 400, 'No delivery partner assigned to this order to reject');
    }

    const deliveryPartnerId = order.deliveryPartnerId;

    // Add to denied list
    order.deniedDeliveryPartners = order.deniedDeliveryPartners || [];
    order.deniedDeliveryPartners.push({
      deliveryPartnerId: deliveryPartnerId,
      reason: reason || 'Rejected by admin on behalf of delivery boy',
      timestamp: new Date()
    });

    // Unassign
    order.deliveryPartnerId = null;

    // Reset delivery state to initial pending state
    order.deliveryState = {
      status: 'pending',
      currentPhase: 'assigned', // Default enum value
      acceptedAt: null,
      reachedPickupAt: null,
      orderIdConfirmedAt: null,
      routeToPickup: undefined,
      routeToDelivery: undefined
    };

    // Clear assignment info but keep some history if needed
    // However, schema structure suggests keeping assignmentInfo for current assignment
    // So we should probably clear relevant fields
    order.assignmentInfo = {
      // keep existing fields like restaurantId, zoneId etc if they are relevant for next assignment
      restaurantId: order.assignmentInfo?.restaurantId,
      zoneId: order.assignmentInfo?.zoneId,
      zoneName: order.assignmentInfo?.zoneName,
      distance: order.assignmentInfo?.distance,

      assignedBy: undefined,
      deliveryPartnerId: undefined,
      assignedAt: undefined,

      // Add unassignment info (though not explicitly in schema assignmentInfo, Mongoose might ignore extra fields or we can add to metadata if schema allows)
      unassignedAt: new Date(),
      unassignedReason: 'admin_rejected_on_behalf'
    };

    await order.save();

    return successResponse(res, 200, 'Order rejected successfully on behalf of delivery boy', {
      order
    });
  } catch (error) {
    console.error('Error rejecting order on behalf of delivery boy:', error);
    return errorResponse(res, 500, 'Failed to reject order on behalf of delivery boy');
  }
});

/**
 * Mark order as picked up by admin (fallback for rider app)
 * POST /api/admin/orders/:orderId/mark-picked-up
 */
export const markOrderAsPickedUp = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Allow picking up orders with status 'preparing' or 'ready'
    if (!['preparing', 'ready'].includes(order.status)) {
      // Also allow if it's already 'out_for_delivery' (idempotent)
      if (order.status === 'out_for_delivery') {
        return successResponse(res, 200, 'Order is already out for delivery', { order });
      }
      return errorResponse(res, 400, `Order cannot be marked as picked up. Current status: ${order.status}`);
    }

    // Update status to 'out_for_delivery'
    order.status = 'out_for_delivery';
    order.tracking.outForDelivery = { status: true, timestamp: new Date() };

    // Update delivery state
    if (!order.deliveryState) {
      order.deliveryState = {
        status: 'picked_up',
        currentPhase: 'en_route_to_delivery'
      };
    } else {
      order.deliveryState.status = 'picked_up';
      order.deliveryState.currentPhase = 'en_route_to_delivery';
      order.deliveryState.orderIdConfirmedAt = new Date();
    }

    // Mark as updated by admin
    order.assignmentInfo = {
      ...(order.assignmentInfo || {}),
      pickedUpByAdmin: true,
      pickedUpByAdminAt: new Date(),
      pickedUpByAdminId: req.user?._id?.toString() || req.admin?._id?.toString() || null
    };

    await order.save();

    // Notify user
    try {
      const { notifyUserOrderUpdate } = await import('../../order/services/userNotificationService.js');
      await notifyUserOrderUpdate(order._id, 'out_for_delivery');
    } catch (e) {
      console.error('Error notifying user:', e);
    }

    // Trigger Socket.IO notification if possible
    try {
      const serverModule = await import('../../../server.js');
      const getIO = serverModule.getIO;
      const io = getIO ? getIO() : null;

      if (io) {
        io.to(`order:${order._id.toString()}`).emit('order_status_update', {
          title: "Order Update",
          message: "Your order is on the way! 🏍️",
          status: 'out_for_delivery',
          orderId: order.orderId,
          timestamp: new Date()
        });
      }
    } catch (socketError) {
      console.warn('⚠️ Failed to send Socket.IO notification:', socketError.message);
    }

    return successResponse(res, 200, 'Order marked as picked up successfully', {
      order
    });
  } catch (error) {
    console.error('Error marking order as picked up:', error);
    return errorResponse(res, 500, 'Failed to mark order as picked up');
  }
});

/**
 * Mark order as delivered by admin (fallback for rider app)
 * POST /api/admin/orders/:orderId/mark-delivered
 */
export const markOrderAsDelivered = asyncHandler(async (req, res) => {
  try {
    const { orderId } = req.params;

    // Find order doc
    let order = null;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findById(orderId);
    }
    if (!order) {
      order = await Order.findOne({ orderId: orderId });
    }

    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Check if already delivered
    if (order.status === 'delivered') {
      return successResponse(res, 200, 'Order is already delivered', { order });
    }

    // Update status to 'delivered'
    order.status = 'delivered';
    order.deliveredAt = new Date();
    order.tracking.delivered = { status: true, timestamp: new Date() };

    // Update delivery state
    if (!order.deliveryState) {
      order.deliveryState = {
        status: 'delivered',
        currentPhase: 'completed'
      };
    } else {
      order.deliveryState.status = 'delivered';
      order.deliveryState.currentPhase = 'completed';
      order.deliveryState.reachedDropAt = new Date();
    }

    // Mark as delivered by admin
    order.assignmentInfo = {
      ...(order.assignmentInfo || {}),
      deliveredByAdmin: true,
      deliveredByAdminAt: new Date(),
      deliveredByAdminId: req.user?._id?.toString() || req.admin?._id?.toString() || null
    };

    await order.save();

    const orderMongoId = order._id;

    // Handle payment status for COD
    if (order.payment?.method === 'cash' || order.payment?.method === 'cod') {
      try {
        const Payment = (await import('../../payment/models/Payment.js')).default;
        await Payment.updateOne(
          { orderId: orderMongoId },
          { $set: { status: 'completed', completedAt: new Date() } }
        );
      } catch (paymentError) {
        console.warn('⚠️ Failed to update Payment record:', paymentError.message);
      }
    }

    // Calculate settlement
    try {
      const { calculateOrderSettlement } = await import('../../order/services/orderSettlementService.js');
      await calculateOrderSettlement(orderMongoId);
    } catch (settlementError) {
      console.error('Error calculating settlement:', settlementError);
    }

    // Release escrow
    try {
      const { releaseEscrow } = await import('../../order/services/escrowWalletService.js');
      await releaseEscrow(orderMongoId);
    } catch (escrowError) {
      console.error('Error releasing escrow:', escrowError);
    }

    // Notify user via Push
    try {
      const { notifyUserOrderUpdate } = await import('../../order/services/userNotificationService.js');
      await notifyUserOrderUpdate(orderMongoId, 'delivered');
    } catch (e) {
      console.error('Error notifying user:', e);
    }

    // Trigger Socket.IO notification
    try {
      const serverModule = await import('../../../server.js');
      const getIO = serverModule.getIO;
      const io = getIO ? getIO() : null;

      if (io) {
        io.to(`order:${order._id.toString()}`).emit('order_status_update', {
          title: "Order Delivered",
          message: "Enjoy your food! 🍱",
          status: 'delivered',
          orderId: order.orderId,
          timestamp: new Date()
        });
      }
    } catch (socketError) {
      console.warn('⚠️ Failed to send Socket.IO notification:', socketError.message);
    }

    return successResponse(res, 200, 'Order marked as delivered successfully', {
      order
    });
  } catch (error) {
    console.error('Error marking order as delivered:', error);
    return errorResponse(res, 500, 'Failed to mark order as delivered');
  }
});
