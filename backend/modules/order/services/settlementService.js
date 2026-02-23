import OrderSettlement from '../models/OrderSettlement.js';
import Order from '../models/Order.js';
import RestaurantWallet from '../../restaurant/models/RestaurantWallet.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import mongoose from 'mongoose';

/**
 * Get pending settlements for restaurants
 */
export const getPendingRestaurantSettlements = async (restaurantId = null, startDate = null, endDate = null) => {
  try {
    // Build date range
    let start = null;
    let end = null;
    if (startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    // Step 1: Query Order model directly for all delivered orders in the date range
    // Use createdAt on Order (order placement date) to match what user selects in UI
    const orderQuery = { status: 'delivered' };

    if (restaurantId && mongoose.Types.ObjectId.isValid(restaurantId)) {
      orderQuery.restaurantId = new mongoose.Types.ObjectId(restaurantId);
    } else if (restaurantId) {
      orderQuery.restaurantId = restaurantId;
    }

    if (start && end) {
      // Filter by order createdAt date range (when order was placed)
      orderQuery.createdAt = { $gte: start, $lte: end };
    }

    const deliveredOrders = await Order.find(orderQuery)
      .populate('restaurantId', 'name restaurantId')
      .sort({ createdAt: -1 })
      .lean();

    if (deliveredOrders.length === 0) return [];

    // Step 2: Find matching OrderSettlement records for these orders
    const orderObjectIds = deliveredOrders.map(o => o._id);
    const settlements = await OrderSettlement.find({
      orderId: { $in: orderObjectIds },
      'restaurantEarning.status': { $ne: 'cancelled' }
    }).lean();

    // Map settlements by orderId for quick lookup
    const settlementMap = {};
    settlements.forEach(s => {
      settlementMap[s.orderId.toString()] = s;
    });

    // Step 3: Build response - use settlement data when available, fallback for orders without settlements
    const result = deliveredOrders.map(order => {
      const settlement = settlementMap[order._id.toString()];
      const restaurantName = order.restaurantName || order.restaurantId?.name || 'N/A';
      const foodPrice = (order.pricing?.subtotal || 0) - (order.pricing?.discount || 0);

      if (settlement) {
        // Return existing settlement data enriched with order status
        return {
          ...settlement,
          orderId: {
            _id: order._id,
            orderId: order.orderId,
            status: order.status,
            deliveredAt: order.deliveredAt
          },
          restaurantName: settlement.restaurantName || restaurantName,
          orderNumber: settlement.orderNumber || order.orderId,
          createdAt: settlement.createdAt || order.createdAt
        };
      }

      // No settlement record — construct from Order data with default commission
      const defaultCommissionPct = 15;
      const commission = Math.round((foodPrice * defaultCommissionPct) / 100 * 100) / 100;
      const netEarning = Math.round((foodPrice - commission) * 100) / 100;

      return {
        _id: order._id,
        orderId: {
          _id: order._id,
          orderId: order.orderId,
          status: order.status,
          deliveredAt: order.deliveredAt
        },
        orderNumber: order.orderId,
        restaurantId: order.restaurantId,
        restaurantName,
        restaurantSettled: false,
        restaurantEarning: {
          foodPrice,
          commission,
          netEarning,
          status: 'pending'
        },
        createdAt: order.createdAt
      };
    });

    return result;
  } catch (error) {
    console.error('Error getting pending restaurant settlements:', error);
    throw error;
  }
};

/**
 * Get pending settlements for delivery partners
 */
export const getPendingDeliverySettlements = async (deliveryId = null, startDate = null, endDate = null) => {
  try {
    const query = {
      'deliveryPartnerEarning.status': 'credited',
      deliveryPartnerSettled: false,
      settlementStatus: 'completed',
      deliveryPartnerId: { $ne: null }
    };

    if (deliveryId) {
      query.deliveryPartnerId = deliveryId;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const settlements = await OrderSettlement.find(query)
      .populate('orderId', 'orderId status deliveredAt')
      .populate('deliveryPartnerId', 'name phone')
      .sort({ createdAt: -1 })
      .lean();

    return settlements;
  } catch (error) {
    console.error('Error getting pending delivery settlements:', error);
    throw error;
  }
};

/**
 * Generate settlement report for restaurants (daily/weekly)
 */
export const generateRestaurantSettlementReport = async (restaurantId, startDate, endDate) => {
  try {
    const settlements = await OrderSettlement.find({
      restaurantId: restaurantId,
      'restaurantEarning.status': 'credited',
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('orderId', 'orderId status deliveredAt')
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = settlements.reduce((sum, s) => sum + s.restaurantEarning.netEarning, 0);
    const totalOrders = settlements.length;
    const totalCommission = settlements.reduce((sum, s) => sum + s.restaurantEarning.commission, 0);

    return {
      restaurantId,
      period: {
        startDate,
        endDate
      },
      summary: {
        totalOrders,
        totalEarnings,
        totalCommission,
        averageOrderValue: totalOrders > 0 ? totalEarnings / totalOrders : 0
      },
      settlements: settlements.map(s => ({
        orderNumber: s.orderNumber,
        orderDate: s.createdAt,
        foodPrice: s.restaurantEarning.foodPrice,
        commission: s.restaurantEarning.commission,
        netEarning: s.restaurantEarning.netEarning,
        status: s.restaurantEarning.status
      }))
    };
  } catch (error) {
    console.error('Error generating restaurant settlement report:', error);
    throw error;
  }
};

/**
 * Generate settlement report for delivery partners (weekly)
 */
export const generateDeliverySettlementReport = async (deliveryId, startDate, endDate) => {
  try {
    const settlements = await OrderSettlement.find({
      deliveryPartnerId: deliveryId,
      'deliveryPartnerEarning.status': 'credited',
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
      .populate('orderId', 'orderId status deliveredAt')
      .sort({ createdAt: -1 })
      .lean();

    const totalEarnings = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.totalEarning, 0);
    const totalOrders = settlements.length;
    const totalDistance = settlements.reduce((sum, s) => sum + (s.deliveryPartnerEarning.distance || 0), 0);
    const totalBasePayout = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.basePayout, 0);
    const totalDistanceCommission = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.distanceCommission, 0);
    const totalSurge = settlements.reduce((sum, s) => sum + s.deliveryPartnerEarning.surgeAmount, 0);

    return {
      deliveryId,
      period: {
        startDate,
        endDate
      },
      summary: {
        totalOrders,
        totalEarnings,
        totalDistance: totalDistance.toFixed(2),
        totalBasePayout,
        totalDistanceCommission,
        totalSurge,
        averageEarningPerOrder: totalOrders > 0 ? totalEarnings / totalOrders : 0
      },
      settlements: settlements.map(s => ({
        orderNumber: s.orderNumber,
        orderDate: s.createdAt,
        distance: s.deliveryPartnerEarning.distance,
        basePayout: s.deliveryPartnerEarning.basePayout,
        distanceCommission: s.deliveryPartnerEarning.distanceCommission,
        surgeAmount: s.deliveryPartnerEarning.surgeAmount,
        totalEarning: s.deliveryPartnerEarning.totalEarning,
        status: s.deliveryPartnerEarning.status
      }))
    };
  } catch (error) {
    console.error('Error generating delivery settlement report:', error);
    throw error;
  }
};

/**
 * Mark settlements as processed (for weekly payouts)
 */
export const markSettlementsAsProcessed = async (settlementIds, actorType, actorId) => {
  try {
    const settlements = await OrderSettlement.find({
      _id: { $in: settlementIds }
    });

    for (const settlement of settlements) {
      settlement.restaurantSettled = true;
      settlement.restaurantEarning.status = 'settled';

      if (settlement.deliveryPartnerId) {
        settlement.deliveryPartnerSettled = true;
        settlement.deliveryPartnerEarning.status = 'settled';
      }

      settlement.settlementStatus = 'completed';

      // Update metadata with payout info
      settlement.metadata = settlement.metadata || new Map();
      settlement.metadata.set('payoutProcessedBy', actorId);
      settlement.metadata.set('payoutProcessedAt', new Date());
      settlement.metadata.set('payoutActorType', actorType);

      await settlement.save();
    }

    return settlements;
  } catch (error) {
    console.error('Error marking settlements as processed:', error);
    throw error;
  }
};

