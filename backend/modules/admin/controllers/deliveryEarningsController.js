import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import Delivery from '../../delivery/models/Delivery.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';
import Order from '../../order/models/Order.js';
import BusinessSettings from '../../admin/models/BusinessSettings.js';
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
 * Get All Delivery Partners Earnings
 * GET /api/admin/delivery-partners/earnings
 * Query params: deliveryPartnerId, period (today, week, month, all), page, limit, search, fromDate, toDate
 */
export const getDeliveryEarnings = asyncHandler(async (req, res) => {
  try {
    const { 
      deliveryPartnerId,
      period = 'all',
      page = 1,
      limit = 50,
      search,
      fromDate,
      toDate
    } = req.query;

    console.log('📊 Admin fetching delivery earnings with params:', {
      deliveryPartnerId,
      period,
      page,
      limit,
      search,
      fromDate,
      toDate
    });

    // Build query for delivery partners
    const deliveryQuery = {};
    if (deliveryPartnerId) {
      deliveryQuery._id = deliveryPartnerId;
    }
    if (search) {
      deliveryQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { deliveryId: { $regex: search, $options: 'i' } }
      ];
    }

    // Get delivery partners
    const deliveries = await Delivery.find(deliveryQuery)
      .select('_id name phone email deliveryId status')
      .lean();

    console.log(`👥 Found ${deliveries.length} delivery partners`);

    const deliveryIds = deliveries.map(d => d._id);
    
    if (deliveryIds.length === 0) {
      console.warn('⚠️ No delivery partners found matching query');
    }

    if (deliveryIds.length === 0) {
      return successResponse(res, 200, 'No delivery partners found', {
        earnings: [],
        summary: {
          totalDeliveryPartners: 0,
          totalEarnings: 0,
          totalOrders: 0
        },
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
        }
      });
    }

    // Calculate date range
    let startDate = null;
    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (fromDate || toDate) {
      if (fromDate) {
        startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
      }
      if (toDate) {
        endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
      }
    } else {
      const now = new Date();
      switch (period) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate = new Date(now);
          const day = startDate.getDay();
          const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
          startDate.setDate(diff);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setDate(startDate.getDate() + 6);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = null;
      }
    }

    // Get all wallets for delivery partners
    // Note: DeliveryWallet uses 'deliveryId' field, not 'deliveryPartnerId'
    const wallets = await DeliveryWallet.find({
      deliveryId: { $in: deliveryIds }
    }).lean();

    // Calculate today's orders directly from Order collection (to include deliveries that might be missing wallet transactions)
    const tStart = new Date();
    tStart.setHours(0, 0, 0, 0);
    const tEnd = new Date();
    tEnd.setHours(23, 59, 59, 999);
    
    const todayTotalOrdersCount = await Order.countDocuments({
      deliveryPartnerId: { $in: deliveryIds },
      status: 'delivered',
      $or: [
        { deliveredAt: { $gte: tStart, $lte: tEnd } },
        { updatedAt: { $gte: tStart, $lte: tEnd } }
      ]
    });

    // 1. Get all earnings transactions from wallets
    let allEarnings = [];
    const processedOrderIds = new Set();
    
    for (const wallet of wallets) {
      // Match wallet.deliveryId with delivery._id
      const delivery = deliveries.find(d => {
        const deliveryId = d._id.toString();
        const walletDeliveryId = wallet.deliveryId?.toString();
        return deliveryId === walletDeliveryId;
      });
      
      if (!delivery) {
        console.warn(`⚠️ No delivery found for wallet with deliveryId: ${wallet.deliveryId}`);
        continue;
      }

      let transactions = wallet.transactions || [];
      
      // Filter by payment type and completed status
      transactions = transactions.filter(t => 
        t.type === 'payment' && 
        t.status === 'Completed'
      );

      // Filter by date range
      if (startDate) {
        const beforeFilter = transactions.length;
        transactions = transactions.filter(t => {
          const transactionDate = t.createdAt || t.processedAt || new Date();
          return transactionDate >= startDate && transactionDate <= endDate;
        });
        console.log(`📅 After date filter: ${transactions.length} transactions (was ${beforeFilter})`);
      }

      if (transactions.length === 0) {
        console.log(`⚠️ No transactions after filtering for ${delivery.name}`);
        continue;
      }

      // Get order details for each transaction
      const orderIds = transactions
        .filter(t => t.orderId)
        .map(t => {
          // Handle both ObjectId and string formats
          if (mongoose.Types.ObjectId.isValid(t.orderId)) {
            return typeof t.orderId === 'string' ? new mongoose.Types.ObjectId(t.orderId) : t.orderId;
          }
          console.warn(`⚠️ Invalid orderId in transaction: ${t.orderId}`);
          return null;
        })
        .filter(Boolean);

      let orders = [];
      if (orderIds.length > 0) {
        try {
          orders = await Order.find({
            _id: { $in: orderIds }
          })
            .select('orderId status createdAt deliveredAt pricing.total pricing.deliveryFee restaurantName address payment.method')
            .lean();
          
          console.log(`📦 Found ${orders.length} orders for ${orderIds.length} order IDs`);
        } catch (orderError) {
          console.error(`❌ Error fetching orders:`, orderError);
        }
      }

      // Create earnings entries
      for (const transaction of transactions) {
        // Find order by matching _id with transaction.orderId
        const order = orders.find(o => {
          const orderMongoId = o._id.toString();
          const transactionOrderId = transaction.orderId?.toString();
          return orderMongoId === transactionOrderId;
        });

        // Track parsed orderMongoId string
        const orderMongoIdStr = transaction.orderId?.toString();
        if (orderMongoIdStr) processedOrderIds.add(orderMongoIdStr);

        // Get transaction date
        const transactionDate = transaction.createdAt || transaction.processedAt || new Date();

        const paymentMethod = order?.payment?.method || '';
        const paymentType = ['cash', 'cod'].includes(String(paymentMethod).toLowerCase())
          ? 'Cash'
          : (paymentMethod ? 'Online' : 'N/A');

        allEarnings.push({
          deliveryPartnerId: delivery._id.toString(),
          deliveryPartnerName: delivery.name || 'Unknown',
          deliveryPartnerPhone: delivery.phone || 'N/A',
          deliveryPartnerEmail: delivery.email || 'N/A',
          deliveryId: delivery.deliveryId || 'N/A',
          transactionId: transaction._id?.toString() || transaction.id || 'N/A',
          orderId: order?.orderId || 'N/A',
          orderMongoId: orderMongoIdStr || null,
          amount: transaction.amount || 0,
          status: transaction.status || 'Completed',
          createdAt: transactionDate,
          deliveredAt: order?.deliveredAt || null,
          orderStatus: order?.status || 'unknown',
          restaurantName: order?.restaurantName || 'N/A',
          orderTotal: order?.pricing?.total || 0,
          deliveryFee: order?.pricing?.deliveryFee || 0,
          customerAddress: order?.address?.formattedAddress || 'N/A',
          paymentType
        });
      }

      console.log(`✅ Added ${transactions.length} earnings entries for ${delivery.name}`);
    }

    // 2. Fetch missing delivered orders that have no wallet transactions
    let missingOrderQuery = {
      deliveryPartnerId: { $in: deliveryIds },
      status: 'delivered'
    };
    
    // Safely exclude already processed orders
    const excludeIds = Array.from(processedOrderIds).filter(id => mongoose.Types.ObjectId.isValid(id));
    if (excludeIds.length > 0) {
      missingOrderQuery._id = { $nin: excludeIds };
    }

    if (startDate) {
      missingOrderQuery.$or = [
        { deliveredAt: { $gte: startDate, $lte: endDate } },
        { updatedAt: { $gte: startDate, $lte: endDate } }
      ];
    }

    try {
      const missingOrders = await Order.find(missingOrderQuery)
        .select('orderId status createdAt deliveredAt updatedAt pricing.total pricing.deliveryFee restaurantName address deliveryPartnerId payment.method')
        .lean();

      console.log(`📦 Found ${missingOrders.length} missing delivered orders without wallet transactions`);

      for (const order of missingOrders) {
        const delivery = deliveries.find(d => d._id.toString() === order.deliveryPartnerId?.toString());
        if (!delivery) continue;

        // Fallback to deliveryFee if no transaction amount exists
        const amount = order.pricing?.deliveryFee || 0;
        const transactionDate = order.deliveredAt || order.updatedAt || new Date();
        const paymentMethod = order?.payment?.method || '';
        const paymentType = ['cash', 'cod'].includes(String(paymentMethod).toLowerCase())
          ? 'Cash'
          : (paymentMethod ? 'Online' : 'N/A');

        allEarnings.push({
          deliveryPartnerId: delivery._id.toString(),
          deliveryPartnerName: delivery.name || 'Unknown',
          deliveryPartnerPhone: delivery.phone || 'N/A',
          deliveryPartnerEmail: delivery.email || 'N/A',
          deliveryId: delivery.deliveryId || 'N/A',
          transactionId: `MISSING-TXN-${order._id}`,
          orderId: order.orderId || 'N/A',
          orderMongoId: order._id.toString(),
          amount: amount,
          status: 'Completed',
          createdAt: transactionDate,
          deliveredAt: order.deliveredAt || null,
          orderStatus: order.status || 'unknown',
          restaurantName: order.restaurantName || 'N/A',
          orderTotal: order.pricing?.total || 0,
          deliveryFee: order.pricing?.deliveryFee || 0,
          customerAddress: order.address?.formattedAddress || 'N/A',
          paymentType
        });
      }
    } catch (missingOrdersError) {
      console.error(`❌ Error fetching missing orders:`, missingOrdersError);
    }

    // Sort by date (newest first)
    allEarnings.sort((a, b) => {
      const dateA = a.createdAt || new Date(0);
      const dateB = b.createdAt || new Date(0);
      return dateB - dateA;
    });

    // Calculate summary
    const totalEarnings = allEarnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalOrders = allEarnings.length;
    const uniqueDeliveryPartners = new Set(allEarnings.map(e => e.deliveryPartnerId?.toString()).filter(Boolean)).size;

    /**
     * Remaining cash limit:
     * - MUST NOT depend on period / date filters
     * - MUST match the Delivery Boy Wallet page
     * - Use the same formula as deliveryBoyWalletController:
     *   remainingCashLimit = max(0, deliveryCashLimitSetting - wallet.cashInHand)
     */
    let remainingCashLimit = null;
    if (deliveryPartnerId && deliveryIds.length === 1) {
      const [wallet, settings] = await Promise.all([
        DeliveryWallet.findOne({ deliveryId: deliveryIds[0] }),
        BusinessSettings.getSettings().catch(() => null)
      ]);

      const totalCashLimit = Number(settings?.deliveryCashLimit) || 0;
      const cashInHand = wallet ? Number(wallet.cashInHand) || 0 : 0;
      remainingCashLimit = Math.max(0, totalCashLimit - cashInHand);
    }

    console.log(`✅ Summary: Total earnings: ₹${totalEarnings}, Total orders: ${totalOrders}, Unique delivery partners: ${uniqueDeliveryPartners}`);

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedEarnings = allEarnings.slice(skip, skip + parseInt(limit));

    console.log(`📄 Returning page ${page} with ${paginatedEarnings.length} earnings (total: ${allEarnings.length})`);

    return successResponse(res, 200, 'Delivery earnings retrieved successfully', {
      earnings: paginatedEarnings,
      summary: {
        period,
        startDate: startDate ? startDate.toISOString() : null,
        endDate: endDate ? endDate.toISOString() : null,
        totalDeliveryPartners: uniqueDeliveryPartners,
        totalEarnings,
        totalOrders,
        todayOrders: todayTotalOrdersCount,
        // settlementAmount kept for backward compatibility (if any old clients use it)
        settlementAmount: remainingCashLimit ?? totalEarnings,
        remainingCashLimit
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: allEarnings.length,
        pages: Math.ceil(allEarnings.length / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching delivery earnings: ${error.message}`, { stack: error.stack });
    return errorResponse(res, 500, 'Failed to fetch delivery earnings');
  }
});

