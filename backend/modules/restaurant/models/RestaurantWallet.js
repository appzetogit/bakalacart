import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['payment', 'withdrawal', 'refund', 'bonus', 'deduction'],
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
    default: 'Pending'
  },
  description: {
    type: String,
    trim: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date
}, {
  timestamps: true,
  _id: true
});

// Withdrawal Request Schema
const withdrawalRequestSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Processed'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'upi', 'card'],
    required: true
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    accountHolderName: String,
    bankName: String
  },
  upiId: String,
  cardDetails: {
    last4Digits: String,
    cardType: String
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: Date,
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    sparse: true
  },
  rejectionReason: String,
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    sparse: true
  }
}, {
  timestamps: true,
  _id: true
});

// Restaurant Wallet Schema
// IMPORTANT: Each restaurant has its own separate wallet
// The unique constraint on restaurantId ensures no restaurant can have multiple wallets
// and no wallet can be shared between restaurants
const restaurantWalletSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true,
    unique: true, // CRITICAL: Ensures one wallet per restaurant
    index: true
  },
  // Balance fields
  totalBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarned: {
    type: Number,
    default: 0,
    min: 0
  },
  // Transactions array
  transactions: [transactionSchema],
  // Withdrawal requests
  withdrawalRequests: [withdrawalRequestSchema],
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  // Last transaction date
  lastTransactionAt: Date
}, {
  timestamps: true
});

// Indexes
restaurantWalletSchema.index({ restaurantId: 1 }, { unique: true }); // Ensure unique index
restaurantWalletSchema.index({ 'transactions.orderId': 1 });
restaurantWalletSchema.index({ 'transactions.status': 1 });
restaurantWalletSchema.index({ 'transactions.type': 1 });
restaurantWalletSchema.index({ lastTransactionAt: -1 });

// Pre-save hook to ensure restaurantId is always an ObjectId
restaurantWalletSchema.pre('save', function(next) {
  // Ensure restaurantId is a valid ObjectId
  if (this.restaurantId && !(this.restaurantId instanceof mongoose.Types.ObjectId)) {
    if (mongoose.Types.ObjectId.isValid(this.restaurantId)) {
      this.restaurantId = new mongoose.Types.ObjectId(this.restaurantId);
    } else {
      return next(new Error(`Invalid restaurantId format: ${this.restaurantId}. Must be a valid MongoDB ObjectId.`));
    }
  }
  next();
});

// Virtual for pending balance (earned but not withdrawn)
restaurantWalletSchema.virtual('pendingBalance').get(function() {
  return this.totalEarned - this.totalWithdrawn;
});

// Method to add transaction and update balances
restaurantWalletSchema.methods.addTransaction = function(transactionData) {
  const transaction = {
    ...transactionData,
    createdAt: new Date()
  };
  
  this.transactions.push(transaction);
  
  // Update balances based on transaction type and status
  if (transaction.status === 'Completed') {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund') {
      this.totalBalance += transaction.amount;
      this.totalEarned += transaction.amount;
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance -= transaction.amount;
      this.totalWithdrawn += transaction.amount;
    } else if (transaction.type === 'deduction') {
      this.totalBalance -= transaction.amount;
    }
  }
  
  this.lastTransactionAt = new Date();
  
  return transaction;
};

// Method to update transaction status
restaurantWalletSchema.methods.updateTransactionStatus = function(transactionId, status, failureReason = null) {
  const transaction = this.transactions.id(transactionId);
  if (!transaction) {
    throw new Error('Transaction not found');
  }
  
  const oldStatus = transaction.status;
  const oldAmount = transaction.amount;
  
  transaction.status = status;
  transaction.processedAt = new Date();
  
  if (status === 'Failed' && failureReason) {
    transaction.failureReason = failureReason;
  }
  
  // If transaction status changed from Pending to Completed, update balances
  if (oldStatus === 'Pending' && status === 'Completed') {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund') {
      this.totalBalance += oldAmount;
      this.totalEarned += oldAmount;
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance -= oldAmount;
      this.totalWithdrawn += oldAmount;
    } else if (transaction.type === 'deduction') {
      this.totalBalance -= oldAmount;
    }
  }
  
  // If transaction status changed from Completed to Failed/Cancelled, reverse balances
  if (oldStatus === 'Completed' && (status === 'Failed' || status === 'Cancelled')) {
    if (transaction.type === 'payment' || transaction.type === 'bonus' || transaction.type === 'refund') {
      this.totalBalance = Math.max(0, this.totalBalance - oldAmount);
      this.totalEarned = Math.max(0, this.totalEarned - oldAmount);
    } else if (transaction.type === 'withdrawal') {
      this.totalBalance += oldAmount;
      this.totalWithdrawn = Math.max(0, this.totalWithdrawn - oldAmount);
    }
  }
  
  return transaction;
};

// Static method to get wallet by restaurant ID or create if doesn't exist
// CRITICAL: Ensures each restaurant has a separate wallet by using MongoDB ObjectId
restaurantWalletSchema.statics.findOrCreateByRestaurantId = async function(restaurantId) {
  // Validate and convert restaurantId to ObjectId
  if (!restaurantId) {
    throw new Error('Restaurant ID is required');
  }

  // Convert to ObjectId if it's a string
  let restaurantObjectId;
  if (mongoose.Types.ObjectId.isValid(restaurantId)) {
    restaurantObjectId = new mongoose.Types.ObjectId(restaurantId);
  } else {
    throw new Error(`Invalid restaurant ID format: ${restaurantId}. Must be a valid MongoDB ObjectId.`);
  }

  // Find wallet by restaurantId (using ObjectId for exact match)
  let wallet = await this.findOne({ restaurantId: restaurantObjectId });
  
  if (!wallet) {
    // Create new wallet for this restaurant
    // The unique constraint on restaurantId ensures no duplicate wallets
    try {
      wallet = await this.create({
        restaurantId: restaurantObjectId,
        totalBalance: 0,
        totalWithdrawn: 0,
        totalEarned: 0
      });
      console.log(`✅ Created new wallet for restaurant: ${restaurantObjectId}`);
    } catch (error) {
      // If unique constraint violation, try to find the wallet again (race condition)
      if (error.code === 11000) {
        console.warn(`⚠️ Wallet creation race condition detected for restaurant ${restaurantObjectId}, fetching existing wallet`);
        wallet = await this.findOne({ restaurantId: restaurantObjectId });
        if (!wallet) {
          throw new Error(`Failed to create or find wallet for restaurant ${restaurantObjectId}`);
        }
      } else {
        throw error;
      }
    }
  }
  
  // Verify wallet belongs to the correct restaurant
  if (wallet.restaurantId.toString() !== restaurantObjectId.toString()) {
    throw new Error(`Wallet restaurantId mismatch: expected ${restaurantObjectId}, got ${wallet.restaurantId}`);
  }
  
  return wallet;
};

export default mongoose.model('RestaurantWallet', restaurantWalletSchema);

