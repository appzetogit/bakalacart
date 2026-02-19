import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import DeliveryWallet from '../../delivery/models/DeliveryWallet.js';

/**
 * List cash limit settlement (deposit) transactions
 * GET /api/admin/cash-limit-settlement
 * Query: search, page, limit, fromDate, toDate
 */
export const getCashLimitSettlements = asyncHandler(async (req, res) => {
  try {
    const { search, page = 1, limit = 50, fromDate, toDate } = req.query;
    const skip = (Math.max(1, parseInt(page)) - 1) * Math.max(1, Math.min(100, parseInt(limit)));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit)));

    const wallets = await DeliveryWallet.find({})
      .populate('deliveryId', 'name deliveryId phone')
      .lean();

    const list = [];
    for (const w of wallets) {
      const txList = (w.transactions || []).filter((t) => t && t.type === 'deposit');
      const d = w.deliveryId || {};
      const deliveryName = d.name || '—';
      const deliveryIdString = d.deliveryId || (d._id ? String(d._id) : '—');
      const phone = d.phone || '—';
      for (const t of txList) {
        const createdAt = t.createdAt ? new Date(t.createdAt) : null;
        if (fromDate && createdAt && createdAt < new Date(fromDate)) continue;
        if (toDate && createdAt && createdAt > new Date(toDate)) continue;
        let meta = t.metadata;
        if (meta && typeof meta.get === 'function') {
          meta = { razorpayOrderId: meta.get('razorpayOrderId'), razorpayPaymentId: meta.get('razorpayPaymentId') };
        }
        list.push({
          id: t._id,
          amount: t.amount,
          description: t.description,
          status: t.status,
          createdAt: t.createdAt,
          razorpayOrderId: meta?.razorpayOrderId,
          razorpayPaymentId: meta?.razorpayPaymentId,
          deliveryId: d._id,
          deliveryName,
          deliveryIdString,
          phone
        });
      }
    }

    list.sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    let filtered = list;
    if (search && String(search).trim()) {
      const q = String(search).trim().toLowerCase();
      filtered = list.filter(
        (r) =>
          (r.deliveryName && r.deliveryName.toLowerCase().includes(q)) ||
          (r.deliveryIdString && r.deliveryIdString.toLowerCase().includes(q)) ||
          (r.phone && r.phone.toLowerCase().includes(q))
      );
    }

    const total = filtered.length;
    const rows = filtered.slice(skip, skip + limitNum);

    return successResponse(res, 200, 'Cash limit settlements retrieved', {
      transactions: rows,
      pagination: {
        page: Math.max(1, parseInt(page)),
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    console.error('Cash limit settlement error:', err?.message || err);
    return errorResponse(res, 500, err?.message || 'Failed to fetch cash limit settlements');
  }
});
/**
 * Approve cash limit settlement (deposit) transaction
 * POST /api/admin/cash-limit-settlement/:id/approve
 */
export const approveCashLimitSettlement = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Find the wallet that contains this transaction
    const wallet = await DeliveryWallet.findOne({ 'transactions._id': id });

    if (!wallet) {
      return errorResponse(res, 404, 'Transaction not found');
    }

    // Find the transaction in the wallet
    const transaction = wallet.transactions.id(id);
    if (!transaction || transaction.type !== 'deposit') {
      return errorResponse(res, 404, 'Deposit transaction not found');
    }

    if (transaction.status === 'Completed') {
      return errorResponse(res, 400, 'Transaction is already completed');
    }

    // Update status to Completed
    // This will automatically update cashInHand via model methods if use updateTransactionStatus
    wallet.updateTransactionStatus(id, 'Completed');
    wallet.markModified('transactions');
    await wallet.save();

    return successResponse(res, 200, 'Settlement approved successfully');
  } catch (err) {
    console.error('Approve settlement error:', err?.message || err);
    return errorResponse(res, 500, err?.message || 'Failed to approve settlement');
  }
});
