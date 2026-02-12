import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Order from '../../order/models/Order.js';
import Payment from '../../payment/models/Payment.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import OrderSettlement from '../../order/models/OrderSettlement.js';
import DeliveryWallet from '../models/DeliveryWallet.js';
import DeliveryBoyCommission from '../../admin/models/DeliveryBoyCommission.js';
import mongoose from 'mongoose';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

/**
 * Get Delivery Partner Trip History
 * GET /api/delivery/trip-history
 * Query params: period (daily/weekly/monthly), date, status, page, limit
 */
export const getTripHistory = asyncHandler(async (req, res) => {
  try {
    const delivery = req.delivery;
    const deliveryId = delivery._id;
    const { 
      period = 'daily', 
      date, 
      status,
      page = 1, 
      limit = 50 
    } = req.query;

    // Build date range based on period
    let startDate, endDate;
    const selectedDate = date ? new Date(date) : new Date();
    
    // Set time to start of day
    selectedDate.setHours(0, 0, 0, 0);

    switch (period) {
      case 'daily':
        startDate = new Date(selectedDate);
        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        // Get start of week (Monday)
        const dayOfWeek = selectedDate.getDay();
        const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust for Monday start
        startDate = new Date(selectedDate);
        startDate.setDate(selectedDate.getDate() + diff);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(selectedDate);
        endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
    }

    // Build query
    const query = {
      deliveryPartnerId: delivery._id,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      }
    };

    // Status filter
    if (status && status !== 'ALL TRIPS') {
      // Map frontend status to backend status
      const statusMap = {
        'Completed': 'delivered',
        'Cancelled': 'cancelled',
        'Pending': 'pending'
      };
      query.status = statusMap[status] || status.toLowerCase();
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch orders
    const orders = await Order.find(query)
      .populate('userId', 'name phone')
      .populate('restaurantId', 'name location restaurantId') // Populate restaurant with location
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count
    const total = await Order.countDocuments(query);

    // Get order IDs for Payment collection lookup
    const orderIds = orders.map(o => o._id);
    
    // Fetch payment records for COD fallback check
    const codOrderIds = new Set();
    try {
      const codPayments = await Payment.find({ 
        orderId: { $in: orderIds }, 
        method: 'cash' 
      }).select('orderId').lean();
      codPayments.forEach(p => codOrderIds.add(p.orderId?.toString()));
    } catch (e) {
      // Ignore payment lookup errors
      logger.warn('Could not fetch payment records for COD check:', e.message);
    }

    // Fetch OrderSettlement records to get delivery boy earnings with full breakdown
    const settlementMap = new Map();
    const settlementDetailsMap = new Map();
    const orderNumberMap = new Map(); // Map orderNumber to orderId for lookup
    
    // Create orderNumber to orderId mapping
    orders.forEach(order => {
      if (order.orderId) {
        orderNumberMap.set(order.orderId, order._id.toString());
      }
    });
    
    try {
      // Convert orderIds to ObjectIds for proper matching
      const orderObjectIds = orderIds.map(id => {
        if (mongoose.Types.ObjectId.isValid(id)) {
          return new mongoose.Types.ObjectId(id);
        }
        return id;
      });

      // Also get orderNumbers for lookup
      const orderNumbers = orders.map(o => o.orderId).filter(Boolean);

      // Query settlements by both orderId and orderNumber
      const settlements = await OrderSettlement.find({
        $or: [
          { orderId: { $in: orderObjectIds } },
          { orderNumber: { $in: orderNumbers } }
        ]
      }).select('_id orderId orderNumber deliveryPartnerEarning').lean();
      
      logger.info(`Found ${settlements.length} settlements for ${orderIds.length} orders`);
      
      // Recalculate settlements that might have old formula
      for (const settlement of settlements) {
        let orderIdKeys = [];
        
        // Try to match by orderId first
        if (settlement.orderId) {
          const orderIdKey = settlement.orderId.toString ? settlement.orderId.toString() : String(settlement.orderId);
          orderIdKeys.push(orderIdKey);
        }
        
        // Also try to match by orderNumber
        if (settlement.orderNumber && orderNumberMap.has(settlement.orderNumber)) {
          const mappedOrderId = orderNumberMap.get(settlement.orderNumber);
          if (mappedOrderId && !orderIdKeys.includes(mappedOrderId)) {
            orderIdKeys.push(mappedOrderId);
          }
        }
        
        let totalEarning = settlement.deliveryPartnerEarning?.totalEarning || 0;
        let deliveryPartnerEarning = settlement.deliveryPartnerEarning;
        
        // Check if settlement was calculated with old formula and recalculate if needed
        if (deliveryPartnerEarning && deliveryPartnerEarning.distance > 0 && deliveryPartnerEarning.distanceCommission > 0) {
          const oldDistance = deliveryPartnerEarning.distance;
          const oldDistanceCommission = deliveryPartnerEarning.distanceCommission;
          const oldCommissionPerKm = deliveryPartnerEarning.commissionPerKm || 0;
          
          // Detect old formula: if distanceCommission ≈ distance × commissionPerKm (entire distance charged)
          // New formula: distanceCommission = (distance - minDistance) × commissionPerKm (only extra distance)
          if (oldCommissionPerKm > 0) {
            const expectedOldFormula = oldDistance * oldCommissionPerKm;
            const tolerance = 0.01;
            
            // If it matches old formula (entire distance charged), recalculate with new formula
            if (Math.abs(oldDistanceCommission - expectedOldFormula) < tolerance) {
              try {
                const commissionResult = await DeliveryBoyCommission.calculateCommission(oldDistance);
                const newDistanceCommission = commissionResult.breakdown.distanceCommission;
                const newTotalEarning = commissionResult.commission;
                
                // Only update if there's a difference (old formula was used)
                if (Math.abs(oldDistanceCommission - newDistanceCommission) > tolerance) {
                  logger.info(`🔄 Recalculating settlement for order ${settlement.orderNumber || settlement.orderId}: Old: ₹${totalEarning.toFixed(2)}, New: ₹${newTotalEarning.toFixed(2)}`);
                  
                  // Update settlement in database
                  await OrderSettlement.findByIdAndUpdate(settlement._id, {
                    $set: {
                      'deliveryPartnerEarning.distanceCommission': newDistanceCommission,
                      'deliveryPartnerEarning.totalEarning': newTotalEarning
                    }
                  });
                  
                  // Update local values
                  totalEarning = newTotalEarning;
                  deliveryPartnerEarning = {
                    ...deliveryPartnerEarning,
                    distanceCommission: newDistanceCommission,
                    totalEarning: newTotalEarning
                  };
                }
              } catch (recalcError) {
                logger.warn(`Could not recalculate settlement for order ${settlement.orderNumber || settlement.orderId}:`, recalcError.message);
              }
            }
          }
        }
        
        // Set earnings for all matching order IDs
        orderIdKeys.forEach(orderIdKey => {
          logger.info(`Settlement found for order ${orderIdKey} (orderNumber: ${settlement.orderNumber}): earnings = ₹${totalEarning}`);
          
          // Only set if not already set (prefer orderId match over orderNumber match)
          if (!settlementMap.has(orderIdKey)) {
            settlementMap.set(orderIdKey, totalEarning);
            // Store full settlement details for breakdown
            if (deliveryPartnerEarning && deliveryPartnerEarning.totalEarning > 0) {
              settlementDetailsMap.set(orderIdKey, {
                deliveryPartnerEarning: deliveryPartnerEarning
              });
            }
          }
        });
      }
      
      // Log all order IDs and their earnings for debugging
      if (settlementMap.size > 0) {
        logger.info(`Settlement map entries: ${Array.from(settlementMap.entries()).map(([id, earning]) => `${id}: ₹${earning}`).join(', ')}`);
      } else {
        logger.warn(`⚠️ No settlements found in map! Check if settlements exist for these orders.`);
      }
      
      // Fallback: If settlement doesn't have earnings, try to get from wallet transactions
      const hasZeroEarnings = Array.from(settlementMap.values()).every(e => e === 0);
      if (settlementMap.size === 0 || hasZeroEarnings) {
        logger.info(`⚠️ No earnings in settlement, checking wallet transactions as fallback...`);
        try {
          const wallet = await DeliveryWallet.findOne({ deliveryPartnerId: deliveryId }).lean();
          if (wallet && wallet.transactions && wallet.transactions.length > 0) {
            // Create a map of orderId to transaction amount
            const walletEarningsMap = new Map();
            wallet.transactions.forEach(transaction => {
              if (transaction.type === 'payment' && transaction.orderId && transaction.amount > 0) {
                const txOrderId = transaction.orderId.toString ? transaction.orderId.toString() : String(transaction.orderId);
                // Only set if not already in settlementMap or if settlement has 0
                if (!settlementMap.has(txOrderId) || settlementMap.get(txOrderId) === 0) {
                  walletEarningsMap.set(txOrderId, transaction.amount);
                }
              }
            });
            
            // Merge wallet earnings into settlement map
            walletEarningsMap.forEach((amount, orderId) => {
              if (!settlementMap.has(orderId) || settlementMap.get(orderId) === 0) {
                settlementMap.set(orderId, amount);
                logger.info(`💰 Found earnings from wallet for order ${orderId}: ₹${amount}`);
              }
            });
          }
        } catch (walletError) {
          logger.warn('Could not fetch wallet transactions for earnings fallback:', walletError.message);
        }
      }
    } catch (e) {
      // Log error details for debugging
      logger.error('Could not fetch settlement records for earnings:', e);
      logger.warn('Could not fetch settlement records for earnings:', e.message);
    }

    // Get unique restaurant IDs that need name lookup (where restaurantName is missing/empty)
    const restaurantIdsToLookup = [...new Set(
      orders
        .filter(o => !o.restaurantName || o.restaurantName === 'Unknown Restaurant' || o.restaurantName.trim() === '')
        .map(o => o.restaurantId)
        .filter(id => id)
    )];

    // Fetch restaurant names for orders missing restaurantName
    const restaurantNameMap = new Map();
    if (restaurantIdsToLookup.length > 0) {
      try {
        // Try to find restaurants by restaurantId (String) or _id (ObjectId)
        const restaurantQueries = restaurantIdsToLookup.map(id => {
          // Check if it's a valid ObjectId
          if (mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
            return {
              $or: [
                { restaurantId: id },
                { _id: new mongoose.Types.ObjectId(id) }
              ]
            };
          } else {
            return { restaurantId: id };
          }
        });

        const restaurants = await Restaurant.find({
          $or: restaurantQueries
        }).select('restaurantId name _id').lean();

        restaurants.forEach(rest => {
          // Map by restaurantId string
          if (rest.restaurantId) {
            restaurantNameMap.set(rest.restaurantId, rest.name);
          }
          // Also map by _id string
          if (rest._id) {
            restaurantNameMap.set(rest._id.toString(), rest.name);
          }
        });
      } catch (e) {
        logger.warn('Could not fetch restaurant names:', e.message);
      }
    }

    // Format response
    const formattedTrips = orders.map((order, index) => {
      // Map backend status to frontend status
      const statusMap = {
        'delivered': 'Completed',
        'cancelled': 'Cancelled',
        'pending': 'Pending',
        'confirmed': 'Pending',
        'preparing': 'Pending',
        'ready': 'Pending',
        'out_for_delivery': 'Pending'
      };

      const displayStatus = statusMap[order.status] || order.status;

      // Format time
      const orderDate = new Date(order.createdAt);
      const hours = orderDate.getHours();
      const minutes = orderDate.getMinutes();
      const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

      // Get restaurant name - use restaurantName field, fallback to Restaurant collection lookup
      let restaurantName = order.restaurantName;
      if (!restaurantName || restaurantName === 'Unknown Restaurant' || restaurantName.trim() === '') {
        // Try to get from lookup map
        restaurantName = restaurantNameMap.get(order.restaurantId) || 
                        restaurantNameMap.get(order.restaurantId?.toString()) ||
                        'Unknown Restaurant';
      }

      // Get delivery boy's earning from settlement, fallback to delivery fee
      const orderIdStr = order._id.toString();
      let earning = settlementMap.get(orderIdStr);
      
      // If not found by orderId, try by orderNumber
      if (earning === undefined && order.orderId) {
        const mappedOrderId = orderNumberMap.get(order.orderId);
        if (mappedOrderId) {
          earning = settlementMap.get(mappedOrderId);
        }
      }
      
      // Final fallback
      if (earning === undefined || earning === null) {
        earning = order.pricing?.deliveryFee || 0;
      }
      
      const amount = earning; // Keep 'amount' field for backward compatibility, but it now represents earning

      // Debug logging
      if (earning === 0 && order.status === 'delivered') {
        logger.warn(`⚠️ Zero earnings found for delivered order ${order.orderId} (${orderIdStr})`);
        logger.warn(`   Settlement map has ${settlementMap.size} entries`);
        logger.warn(`   Settlement map keys: ${Array.from(settlementMap.keys()).slice(0, 5).join(', ')}...`);
        logger.warn(`   Order _id: ${orderIdStr}, orderId: ${order.orderId}`);
        logger.warn(`   Checking if settlement exists for orderNumber: ${order.orderId}`);
      } else if (earning > 0) {
        logger.info(`✅ Earnings found for order ${order.orderId}: ₹${earning}`);
      }

      // Get settlement details for earnings breakdown (already fetched in batch above)
      const settlementDetails = settlementDetailsMap.get(orderIdStr) || settlementDetailsMap.get(order._id.toString()) || null;

      // Get payment method - check Payment collection as fallback (for COD orders)
      let paymentMethod = order.payment?.method || 'razorpay';
      // If order.payment.method is not 'cash', check Payment collection for COD
      if (paymentMethod !== 'cash' && codOrderIds.has(order._id?.toString())) {
        paymentMethod = 'cash';
      }

      // Get restaurant location
      const restaurantLocation = order.restaurantId?.location || null;

      return {
        id: order._id.toString(),
        orderId: order.orderId,
        restaurant: restaurantName,
        restaurantName: restaurantName, // Also include for compatibility
        restaurantId: order.restaurantId ? {
          _id: order.restaurantId._id || order.restaurantId,
          name: restaurantName,
          location: restaurantLocation // Include restaurant location
        } : null,
        customer: order.userId?.name || 'Unknown Customer',
        userId: order.userId || null, // Include user data
        address: order.address || null, // Include customer address
        items: order.items || [], // Include order items
        pricing: order.pricing || null, // Include pricing details
        status: displayStatus,
        time,
        amount, // Actual earnings from settlement
        earnings: amount, // Alias for backward compatibility
        settlement: settlementDetails, // Include settlement details for earnings breakdown
        paymentMethod: paymentMethod,
        payment: {
          method: paymentMethod
        },
        date: order.createdAt,
        createdAt: order.createdAt,
        deliveredAt: order.deliveredAt,
        cancelledAt: order.cancelledAt
      };
    });

    return successResponse(res, 200, 'Trip history retrieved successfully', {
      trips: formattedTrips,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      period,
      dateRange: {
        startDate,
        endDate
      }
    });
  } catch (error) {
    logger.error(`Error fetching trip history: ${error.message}`, { error: error.stack });
    return errorResponse(res, 500, 'Failed to fetch trip history');
  }
});

