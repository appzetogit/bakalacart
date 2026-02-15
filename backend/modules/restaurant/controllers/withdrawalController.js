import WithdrawalRequest from '../models/WithdrawalRequest.js';
import RestaurantWallet from '../models/RestaurantWallet.js';
import Restaurant from '../models/Restaurant.js';
import Order from '../../order/models/Order.js';
import RestaurantCommission from '../../admin/models/RestaurantCommission.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import asyncHandler from '../../../shared/middleware/asyncHandler.js';
import winston from 'winston';
import mongoose from 'mongoose';

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
 * Create Withdrawal Request
 * POST /api/restaurant/withdrawal/request
 */
export const createWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { amount } = req.body;

    if (!restaurant || !restaurant._id) {
      return errorResponse(res, 401, 'Restaurant authentication required');
    }

    // Validate amount
    if (amount === undefined || amount === null || amount === '') {
      return errorResponse(res, 400, 'Withdrawal amount is required');
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return errorResponse(res, 400, 'Valid withdrawal amount is required (must be a positive number)');
    }

    // Check minimum withdrawal amount (if configured)
    const minWithdrawalAmount = 1; // Minimum ₹1
    if (parsedAmount < minWithdrawalAmount) {
      return errorResponse(res, 400, `Minimum withdrawal amount is ₹${minWithdrawalAmount}`);
    }

    // Calculate available balance from current cycle (matching finance API logic)
    // This ensures withdrawal validation matches what frontend shows
    const now = new Date();
    const currentDay = now.getDay();
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const currentCycleStart = new Date(now);
    currentCycleStart.setDate(now.getDate() - daysFromMonday);
    currentCycleStart.setHours(0, 0, 0, 0);
    
    const currentCycleEnd = new Date(currentCycleStart);
    currentCycleEnd.setDate(currentCycleStart.getDate() + 6);
    currentCycleEnd.setHours(23, 59, 59, 999);

    // Get restaurant ID
    const restaurantId = restaurant._id?.toString() || restaurant.restaurantId || restaurant.id;
    let restaurantObjectId = null;
    if (mongoose.Types.ObjectId.isValid(restaurantId)) {
      restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
    }

    // Get current cycle orders
    const currentCycleOrders = await Order.find({
      restaurantId: restaurantObjectId || restaurantId,
      status: { $in: ['delivered', 'completed'] },
      createdAt: {
        $gte: currentCycleStart,
        $lte: currentCycleEnd
      }
    }).lean();

    // Calculate current cycle payout
    let currentCyclePayout = 0;
    for (const order of currentCycleOrders) {
      const orderTotal = order.pricing?.subtotal || order.pricing?.total || 0;
      const commissionResult = await RestaurantCommission.calculateCommissionForOrder(
        restaurant._id,
        orderTotal
      );
      const commissionAmount = commissionResult.commission || 0;
      const restaurantEarning = orderTotal - commissionAmount;
      currentCyclePayout += restaurantEarning;
    }

    // Get all withdrawals (pending + approved) - matching finance API logic
    // Finance API gets ALL withdrawals, not just current cycle, to show accurate available balance
    const allWithdrawals = await WithdrawalRequest.find({
      restaurantId: restaurant._id,
      status: { $in: ['Pending', 'Approved'] }
    }).lean();

    const totalWithdrawals = allWithdrawals.reduce((sum, req) => sum + (req.amount || 0), 0);
    const availableBalance = Math.max(0, Math.round((currentCyclePayout - totalWithdrawals) * 100) / 100);

    // Check if sufficient balance
    if (parsedAmount > availableBalance) {
      return errorResponse(res, 400, `Insufficient balance. Available balance: ₹${availableBalance.toFixed(2)}`);
    }

    // Also get wallet for transaction creation
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(restaurant._id);

    // Check for pending requests
    const pendingRequest = await WithdrawalRequest.findOne({
      restaurantId: restaurant._id,
      status: 'Pending'
    });

    if (pendingRequest) {
      return errorResponse(res, 400, 'You already have a pending withdrawal request');
    }

    // Get restaurant details
    const restaurantDetails = await Restaurant.findById(restaurant._id).select('name restaurantId');

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create({
      restaurantId: restaurant._id,
      amount: parsedAmount,
      status: 'Pending',
      restaurantName: restaurantDetails?.name || restaurant.name || 'Unknown',
      restaurantIdString: restaurantDetails?.restaurantId || restaurant.restaurantId || restaurant._id.toString()
    });

    // Deduct balance immediately when withdrawal request is created
    // Create a pending withdrawal transaction
    const withdrawalRequestId = withdrawalRequest._id.toString();
    const transaction = wallet.addTransaction({
      amount: parsedAmount,
      type: 'withdrawal',
      status: 'Pending',
      description: `Withdrawal request created - Request ID: ${withdrawalRequestId}`
    });

    // Manually deduct from balance (since addTransaction only deducts when status is 'Completed')
    wallet.totalBalance = Math.max(0, (wallet.totalBalance || 0) - parsedAmount);
    wallet.totalWithdrawn = (wallet.totalWithdrawn || 0) + parsedAmount;
    await wallet.save();

    // Link transaction ID to withdrawal request for easier tracking
    withdrawalRequest.transactionId = transaction._id;
    await withdrawalRequest.save();

    logger.info(`Withdrawal request created: ${withdrawalRequest._id} for restaurant: ${restaurant._id}, amount: ${parsedAmount}. Balance deducted immediately.`);

    return successResponse(res, 201, 'Withdrawal request created successfully', {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        requestedAt: withdrawalRequest.requestedAt,
        createdAt: withdrawalRequest.createdAt
      }
    });
  } catch (error) {
    logger.error(`Error creating withdrawal request: ${error.message}`, error.stack);
    return errorResponse(res, 500, error.message || 'Failed to create withdrawal request');
  }
});

/**
 * Get Restaurant Withdrawal Requests (for restaurant)
 * GET /api/restaurant/withdrawal/requests
 */
export const getRestaurantWithdrawalRequests = asyncHandler(async (req, res) => {
  try {
    const restaurant = req.restaurant;
    const { status, page = 1, limit = 20 } = req.query;

    if (!restaurant || !restaurant._id) {
      return errorResponse(res, 401, 'Restaurant authentication required');
    }

    const query = { restaurantId: restaurant._id };
    if (status && ['Pending', 'Approved', 'Rejected', 'Processed'].includes(status)) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const requests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('processedBy', 'name email')
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    return successResponse(res, 200, 'Withdrawal requests retrieved successfully', {
      requests: requests.map(req => ({
        id: req._id,
        amount: req.amount,
        status: req.status,
        requestedAt: req.requestedAt,
        processedAt: req.processedAt,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching withdrawal requests: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch withdrawal requests');
  }
});

/**
 * Get All Withdrawal Requests (for admin)
 * GET /api/admin/withdrawal/requests
 */
export const getAllWithdrawalRequests = asyncHandler(async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const query = {};
    if (status && ['Pending', 'Approved', 'Rejected', 'Processed'].includes(status)) {
      query.status = status;
    }

    // Search by restaurant name or ID
    if (search) {
      query.$or = [
        { restaurantName: { $regex: search, $options: 'i' } },
        { restaurantIdString: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const requests = await WithdrawalRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('restaurantId', 'name restaurantId address')
      .populate('processedBy', 'name email')
      .lean();

    const total = await WithdrawalRequest.countDocuments(query);

    return successResponse(res, 200, 'Withdrawal requests retrieved successfully', {
      requests: requests.map(req => ({
        id: req._id,
        restaurantId: req.restaurantId?._id || req.restaurantId,
        restaurantName: req.restaurantName || req.restaurantId?.name || 'Unknown',
        restaurantIdString: req.restaurantIdString || req.restaurantId?.restaurantId || 'N/A',
        restaurantAddress: req.restaurantId?.address || 'N/A',
        amount: req.amount,
        status: req.status,
        requestedAt: req.requestedAt,
        processedAt: req.processedAt,
        processedBy: req.processedBy ? {
          name: req.processedBy.name,
          email: req.processedBy.email
        } : null,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error fetching all withdrawal requests: ${error.message}`);
    return errorResponse(res, 500, 'Failed to fetch withdrawal requests');
  }
});

/**
 * Approve Withdrawal Request (admin only)
 * POST /api/admin/withdrawal/:id/approve
 */
export const approveWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const { id } = req.params;

    if (!admin || !admin._id) {
      return errorResponse(res, 401, 'Admin authentication required');
    }

    const withdrawalRequest = await WithdrawalRequest.findById(id).populate('restaurantId');

    if (!withdrawalRequest) {
      return errorResponse(res, 404, 'Withdrawal request not found');
    }

    if (withdrawalRequest.status !== 'Pending') {
      return errorResponse(res, 400, `Withdrawal request is already ${withdrawalRequest.status}`);
    }

    // Get restaurant wallet
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(withdrawalRequest.restaurantId._id);

    // Update withdrawal request
    withdrawalRequest.status = 'Approved';
    withdrawalRequest.processedAt = new Date();
    withdrawalRequest.processedBy = admin._id;
    await withdrawalRequest.save();

    // Find and update the pending withdrawal transaction to Completed
    // Balance was already deducted when request was created, so we just mark transaction as completed
    let pendingTransaction = null;
    
    if (withdrawalRequest.transactionId) {
      // Find transaction by ID if linked
      pendingTransaction = wallet.transactions.id(withdrawalRequest.transactionId);
    }
    
    if (!pendingTransaction) {
      // Fallback: find by description
      pendingTransaction = wallet.transactions.find(
        t => t.type === 'withdrawal' && 
             t.status === 'Pending' && 
             t.description?.includes(withdrawalRequest._id.toString())
      );
    }

    if (pendingTransaction) {
      // Update transaction status to Completed
      pendingTransaction.status = 'Completed';
      pendingTransaction.processedAt = new Date();
      // Balance was already deducted, so no need to deduct again
    } else {
      // If transaction not found, create a new one (fallback)
      wallet.addTransaction({
        amount: withdrawalRequest.amount,
        type: 'withdrawal',
        status: 'Completed',
        description: `Withdrawal request approved - Request ID: ${withdrawalRequest._id}`
      });
      // Balance already deducted, so we don't deduct again
    }

    await wallet.save();

    logger.info(`Withdrawal request approved: ${id} by admin: ${admin._id}`);

    return successResponse(res, 200, 'Withdrawal request approved successfully', {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        processedAt: withdrawalRequest.processedAt
      }
    });
  } catch (error) {
    logger.error(`Error approving withdrawal request: ${error.message}`);
    return errorResponse(res, 500, 'Failed to approve withdrawal request');
  }
});

/**
 * Reject Withdrawal Request (admin only)
 * POST /api/admin/withdrawal/:id/reject
 */
export const rejectWithdrawalRequest = asyncHandler(async (req, res) => {
  try {
    const admin = req.admin;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!admin || !admin._id) {
      return errorResponse(res, 401, 'Admin authentication required');
    }

    const withdrawalRequest = await WithdrawalRequest.findById(id);

    if (!withdrawalRequest) {
      return errorResponse(res, 404, 'Withdrawal request not found');
    }

    if (withdrawalRequest.status !== 'Pending') {
      return errorResponse(res, 400, `Withdrawal request is already ${withdrawalRequest.status}`);
    }

    // Get restaurant wallet to refund the balance
    const wallet = await RestaurantWallet.findOrCreateByRestaurantId(withdrawalRequest.restaurantId);

    // Update withdrawal request
    withdrawalRequest.status = 'Rejected';
    withdrawalRequest.processedAt = new Date();
    withdrawalRequest.processedBy = admin._id;
    if (rejectionReason) {
      withdrawalRequest.rejectionReason = rejectionReason;
    }
    await withdrawalRequest.save();

    // Find and update the pending withdrawal transaction to Cancelled
    // Refund the balance back
    let pendingTransaction = null;
    
    if (withdrawalRequest.transactionId) {
      // Find transaction by ID if linked
      pendingTransaction = wallet.transactions.id(withdrawalRequest.transactionId);
    }
    
    if (!pendingTransaction) {
      // Fallback: find by description
      pendingTransaction = wallet.transactions.find(
        t => t.type === 'withdrawal' && 
             t.status === 'Pending' && 
             t.description?.includes(withdrawalRequest._id.toString())
      );
    }

    if (pendingTransaction) {
      // Update transaction status to Cancelled
      pendingTransaction.status = 'Cancelled';
      pendingTransaction.processedAt = new Date();
      
      // Refund the balance back
      wallet.totalBalance = (wallet.totalBalance || 0) + withdrawalRequest.amount;
      wallet.totalWithdrawn = Math.max(0, (wallet.totalWithdrawn || 0) - withdrawalRequest.amount);
    } else {
      // If transaction not found, create a refund transaction (fallback)
      wallet.addTransaction({
        amount: withdrawalRequest.amount,
        type: 'refund',
        status: 'Completed',
        description: `Withdrawal request rejected - Refund for Request ID: ${withdrawalRequest._id}`
      });
      // Refund the balance
      wallet.totalBalance = (wallet.totalBalance || 0) + withdrawalRequest.amount;
      wallet.totalWithdrawn = Math.max(0, (wallet.totalWithdrawn || 0) - withdrawalRequest.amount);
    }

    await wallet.save();

    logger.info(`Withdrawal request rejected: ${id} by admin: ${admin._id}. Balance refunded.`);

    return successResponse(res, 200, 'Withdrawal request rejected successfully', {
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        status: withdrawalRequest.status,
        processedAt: withdrawalRequest.processedAt,
        rejectionReason: withdrawalRequest.rejectionReason
      }
    });
  } catch (error) {
    logger.error(`Error rejecting withdrawal request: ${error.message}`);
    return errorResponse(res, 500, 'Failed to reject withdrawal request');
  }
});

