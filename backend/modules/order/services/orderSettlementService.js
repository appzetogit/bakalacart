import Order from '../models/Order.js';
import OrderSettlement from '../models/OrderSettlement.js';
import RestaurantCommission from '../../admin/models/RestaurantCommission.js';
import DeliveryBoyCommission from '../../admin/models/DeliveryBoyCommission.js';
import FeeSettings from '../../admin/models/FeeSettings.js';
import Restaurant from '../../restaurant/models/Restaurant.js';
import mongoose from 'mongoose';
import { calculateDistance } from './orderCalculationService.js';
import { logger } from '../../../shared/utils/logger.js';

/**
 * Calculate comprehensive order settlement breakdown
 * This calculates earnings for User, Restaurant, Delivery Partner, and Admin
 */
export const calculateOrderSettlement = async (orderId) => {
  try {
    // Fetch order with all necessary fields populated
    const order = await Order.findById(orderId)
      .populate('restaurantId', 'name location address')
      .populate('deliveryPartnerId', 'name')
      .lean();
    if (!order) {
      throw new Error('Order not found');
    }

    // Get fee settings
    const feeSettings = await FeeSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean();
    
    const platformFee = feeSettings?.platformFee || 5;
    const gstRate = (feeSettings?.gstRate || 5) / 100;

    // Get restaurant details (use populated data if available, otherwise fetch)
    let restaurant = null;
    if (order.restaurantId && typeof order.restaurantId === 'object' && order.restaurantId._id) {
      // Already populated
      restaurant = order.restaurantId;
    } else if (mongoose.Types.ObjectId.isValid(order.restaurantId) && order.restaurantId.length === 24) {
      restaurant = await Restaurant.findById(order.restaurantId).lean();
    }
    if (!restaurant) {
      restaurant = await Restaurant.findOne({
        $or: [
          { restaurantId: order.restaurantId },
          { slug: order.restaurantId }
        ]
      }).lean();
    }

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Calculate user payment breakdown
    const userPayment = {
      subtotal: order.pricing.subtotal || 0,
      discount: order.pricing.discount || 0,
      deliveryFee: order.pricing.deliveryFee || 0,
      platformFee: order.pricing.platformFee || platformFee,
      gst: order.pricing.tax || 0,
      packagingFee: 0, // Can be added later if needed
      total: order.pricing.total || 0
    };

    // Calculate restaurant commission and earnings
    // Commission is calculated on food price (subtotal - discount)
    const foodPrice = userPayment.subtotal - userPayment.discount;
    const restaurantCommissionData = await RestaurantCommission.calculateCommissionForOrder(
      restaurant._id,
      foodPrice
    );

    const commissionAmount = Math.round(restaurantCommissionData.commission * 100) / 100;
    const restaurantNetEarning = Math.round((foodPrice - commissionAmount) * 100) / 100;

    const restaurantEarning = {
      foodPrice: foodPrice, // Full order value (₹200)
      commission: commissionAmount, // Commission deducted (₹30 for 15%)
      commissionPercentage: restaurantCommissionData.type === 'percentage' 
        ? restaurantCommissionData.value 
        : (commissionAmount / foodPrice) * 100,
      netEarning: restaurantNetEarning, // Amount restaurant receives (₹170)
      status: 'pending'
    };

    // Calculate delivery partner earnings
    let deliveryPartnerEarning = {
      basePayout: 0,
      distance: 0,
      commissionPerKm: 0,
      distanceCommission: 0,
      surgeMultiplier: 1,
      surgeAmount: 0,
      totalEarning: 0,
      status: 'pending'
    };

    // Try multiple sources for distance and delivery partner ID
    let deliveryDistance = 0;
    // Handle both populated and non-populated deliveryPartnerId
    let deliveryPartnerId = null;
    if (order.deliveryPartnerId) {
      if (typeof order.deliveryPartnerId === 'object' && order.deliveryPartnerId._id) {
        // Already populated
        deliveryPartnerId = order.deliveryPartnerId._id;
      } else {
        // String or ObjectId
        deliveryPartnerId = order.deliveryPartnerId;
      }
    }

    // Priority 1: Get distance from assignmentInfo
    if (order.assignmentInfo?.distance) {
      deliveryDistance = order.assignmentInfo.distance;
    }
    // Priority 2: Get distance from deliveryState.routeToDelivery
    else if (order.deliveryState?.routeToDelivery?.distance) {
      deliveryDistance = order.deliveryState.routeToDelivery.distance;
    }
    // Priority 3: Calculate distance from restaurant to customer if coordinates available
    else if (order.restaurantId?.location?.coordinates && order.address?.location?.coordinates) {
      const [restaurantLng, restaurantLat] = order.restaurantId.location.coordinates;
      const [customerLng, customerLat] = order.address.location.coordinates;

      // Calculate distance using Haversine formula
      const R = 6371; // Earth radius in km
      const dLat = (customerLat - restaurantLat) * Math.PI / 180;
      const dLng = (customerLng - restaurantLng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(restaurantLat * Math.PI / 180) * Math.cos(customerLat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      deliveryDistance = R * c;
    }

    // Calculate earnings if we have delivery partner and distance
    if (deliveryPartnerId && deliveryDistance > 0) {
      const deliveryCommission = await DeliveryBoyCommission.calculateCommission(deliveryDistance);
      
      // Get surge multiplier (can be configured in order or settings)
      const surgeMultiplier = order.assignmentInfo?.surgeMultiplier || 1;
      const baseEarning = deliveryCommission.commission;
      const surgeAmount = baseEarning * (surgeMultiplier - 1);

      deliveryPartnerEarning = {
        basePayout: deliveryCommission.breakdown.basePayout,
        distance: deliveryDistance,
        commissionPerKm: deliveryCommission.breakdown.commissionPerKm,
        distanceCommission: deliveryCommission.breakdown.distanceCommission,
        surgeMultiplier: surgeMultiplier,
        surgeAmount: surgeAmount,
        totalEarning: baseEarning + surgeAmount,
        status: 'pending'
      };
    }

    // Calculate admin/platform earnings
    // Admin gets: Restaurant commission + Platform fee + Delivery fee + GST
    // Note: Even if delivery is free for user, delivery fee amount still goes to admin
    const deliveryMargin = userPayment.deliveryFee - deliveryPartnerEarning.totalEarning;
    
    const adminCommission = Math.round(restaurantEarning.commission * 100) / 100;
    const adminPlatformFee = Math.round(userPayment.platformFee * 100) / 100;
    const adminDeliveryFee = Math.round(userPayment.deliveryFee * 100) / 100;
    const adminGST = Math.round(userPayment.gst * 100) / 100;
    const adminTotal = Math.round((adminCommission + adminPlatformFee + adminDeliveryFee + adminGST) * 100) / 100;
    
    const adminEarning = {
      commission: adminCommission, // Restaurant commission (₹30)
      platformFee: adminPlatformFee, // Platform fee (₹6)
      deliveryFee: adminDeliveryFee, // Delivery fee (₹0 if free, but still tracked)
      gst: adminGST, // GST (₹10)
      deliveryMargin: Math.max(0, Math.round(deliveryMargin * 100) / 100), // Delivery fee - delivery partner earning
      totalEarning: adminTotal, // Total admin earnings
      status: 'pending'
    };

    // Create or update settlement
    let settlement = await OrderSettlement.findOne({ orderId });
    
    // Get delivery partner ID (handle both populated and non-populated cases)
    let deliveryPartnerIdValue = deliveryPartnerId; // Already extracted above

    const settlementData = {
      orderNumber: order.orderId,
      userId: order.userId,
      restaurantId: restaurant._id,
      restaurantName: restaurant.name || order.restaurantName,
      deliveryPartnerId: deliveryPartnerIdValue,
      userPayment,
      restaurantEarning,
      deliveryPartnerEarning,
      adminEarning,
      escrowStatus: 'pending',
      escrowAmount: userPayment.total,
      settlementStatus: 'pending',
      calculationSnapshot: {
        feeSettings: {
          platformFee: feeSettings?.platformFee,
          gstRate: feeSettings?.gstRate,
          deliveryFee: feeSettings?.deliveryFee
        },
        restaurantCommission: {
          type: restaurantCommissionData.type,
          value: restaurantCommissionData.value,
          rule: restaurantCommissionData.rule
        },
        deliveryCommission: deliveryPartnerEarning.distance > 0 ? {
          distance: deliveryPartnerEarning.distance,
          basePayout: deliveryPartnerEarning.basePayout,
          commissionPerKm: deliveryPartnerEarning.commissionPerKm
        } : null,
        calculatedAt: new Date()
      }
    };

    if (settlement) {
      // Always update deliveryPartnerId if it exists in order (even if it was null before)
      if (deliveryPartnerIdValue) {
        settlement.deliveryPartnerId = deliveryPartnerIdValue;
        logger.log(`✅ Updated deliveryPartnerId in settlement: ${deliveryPartnerIdValue.toString()}`);
      }
      
      // Check if settlement was calculated with old formula (entire distance instead of extra distance)
      // Old formula: distanceCommission = distance × commissionPerKm
      // New formula: distanceCommission = (distance - minDistance) × commissionPerKm
      let needsRecalculation = false;
      if (deliveryPartnerIdValue && deliveryPartnerEarning.distance > 0 && settlement.deliveryPartnerEarning?.distanceCommission > 0) {
        const oldDistanceCommission = settlement.deliveryPartnerEarning.distanceCommission;
        const oldDistance = settlement.deliveryPartnerEarning.distance;
        const oldCommissionPerKm = settlement.deliveryPartnerEarning.commissionPerKm || deliveryPartnerEarning.commissionPerKm;
        
        // Detect old formula: if distanceCommission ≈ distance × commissionPerKm (within 0.01 tolerance)
        const expectedOldFormula = oldDistance * oldCommissionPerKm;
        const tolerance = 0.01;
        if (Math.abs(oldDistanceCommission - expectedOldFormula) < tolerance) {
          // This might be old formula, but also check if distance > minDistance
          // If distance > minDistance and old formula was used, we need to recalculate
          const deliveryCommission = await DeliveryBoyCommission.calculateCommission(oldDistance);
          const expectedNewFormula = deliveryCommission.breakdown.distanceCommission;
          if (Math.abs(oldDistanceCommission - expectedNewFormula) > tolerance) {
            needsRecalculation = true;
            logger.log(`🔄 Detected old formula settlement. Old: ₹${oldDistanceCommission.toFixed(2)}, New: ₹${expectedNewFormula.toFixed(2)}. Recalculating...`);
          }
        }
      }
      
      // Always update earnings if delivery partner exists and we have earnings (or if recalculation needed)
      if (deliveryPartnerIdValue && (deliveryPartnerEarning.totalEarning > 0 || needsRecalculation)) {
        settlement.deliveryPartnerEarning = deliveryPartnerEarning;
        logger.log(`✅ Updated deliveryPartnerEarning: ₹${deliveryPartnerEarning.totalEarning}`);
      } else if (deliveryPartnerIdValue && deliveryPartnerEarning.totalEarning === 0) {
        // Even if earnings is 0, update it to ensure distance and other fields are set
        settlement.deliveryPartnerEarning = deliveryPartnerEarning;
        logger.log(`⚠️ Updated deliveryPartnerEarning with 0 (distance might be missing)`);
      }
      
      // Update other fields (but don't overwrite deliveryPartnerId if we just set it)
      const fieldsToUpdate = { ...settlementData };
      if (deliveryPartnerIdValue) {
        fieldsToUpdate.deliveryPartnerId = deliveryPartnerIdValue; // Ensure it's set
      }
      Object.assign(settlement, fieldsToUpdate);
      
      await settlement.save();
      logger.log(`✅ Settlement updated for order ${order.orderId}. Delivery earnings: ₹${settlement.deliveryPartnerEarning?.totalEarning || 0}`);
    } else {
      settlement = await OrderSettlement.create({
        orderId,
        ...settlementData
      });
      logger.log(`✅ Settlement created for order ${order.orderId}. Delivery earnings: ₹${settlement.deliveryPartnerEarning?.totalEarning || 0}`);
    }

    // Verify settlement was saved correctly
    const verifySettlement = await OrderSettlement.findOne({ orderId }).lean();
    if (verifySettlement) {
      logger.log(`✅ Verified settlement exists for order ${order.orderId}`);
      logger.log(`   DeliveryPartnerId: ${verifySettlement.deliveryPartnerId?.toString() || 'null'}`);
      logger.log(`   Earnings: ₹${verifySettlement.deliveryPartnerEarning?.totalEarning || 0}`);
      logger.log(`   Distance: ${verifySettlement.deliveryPartnerEarning?.distance || 0} km`);
    } else {
      console.error(`❌ Settlement verification failed for order ${order.orderId}`);
    }

    return settlement;
  } catch (error) {
    console.error('Error calculating order settlement:', error);
    throw new Error(`Failed to calculate order settlement: ${error.message}`);
  }
};

/**
 * Get settlement details for an order
 */
export const getOrderSettlement = async (orderId) => {
  try {
    let settlement = await OrderSettlement.findOne({ orderId })
      .populate('orderId', 'orderId status')
      .populate('restaurantId', 'name restaurantId')
      .populate('deliveryPartnerId', 'name phone')
      .lean();

    if (!settlement) {
      // Calculate if doesn't exist
      settlement = await calculateOrderSettlement(orderId);
    }

    return settlement;
  } catch (error) {
    console.error('Error getting order settlement:', error);
    throw error;
  }
};

/**
 * Update settlement when order status changes
 */
export const updateSettlementOnStatusChange = async (orderId, newStatus, previousStatus) => {
  try {
    const settlement = await OrderSettlement.findOne({ orderId });
    if (!settlement) {
      return;
    }

    // Update escrow status based on order status
    if (newStatus === 'delivered') {
      settlement.escrowStatus = 'released';
      settlement.escrowReleasedAt = new Date();
      settlement.settlementStatus = 'completed';
    } else if (newStatus === 'cancelled') {
      settlement.escrowStatus = 'refunded';
      settlement.settlementStatus = 'cancelled';
    }

    await settlement.save();
  } catch (error) {
    console.error('Error updating settlement on status change:', error);
    throw error;
  }
};

