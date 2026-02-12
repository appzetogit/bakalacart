import mongoose from 'mongoose';

const deliveryBoyCommissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    minDistance: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => value >= 0,
        message: 'Minimum distance must be 0 or greater'
      }
    },
    maxDistance: {
      type: Number,
      default: null, // null means unlimited
      validate: {
        validator: function(value) {
          // Allow null (unlimited)
          if (value === null || value === undefined) return true;
          // If value is provided, it must be greater than minDistance
          if (this.minDistance !== undefined && this.minDistance !== null) {
            return parseFloat(value) > parseFloat(this.minDistance);
          }
          return true;
        },
        message: 'Maximum distance must be greater than minimum distance'
      }
    },
    commissionPerKm: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => value >= 0,
        message: 'Commission per km must be 0 or greater'
      }
    },
    basePayout: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: (value) => value >= 0,
        message: 'Base payout must be 0 or greater'
      }
    },
    status: {
      type: Boolean,
      default: true
    },
    // Created by admin
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      required: true
    },
    // Updated by admin
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    // Metadata
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Indexes
deliveryBoyCommissionSchema.index({ minDistance: 1, maxDistance: 1 });
deliveryBoyCommissionSchema.index({ status: 1 });
deliveryBoyCommissionSchema.index({ createdAt: -1 });
deliveryBoyCommissionSchema.index({ createdBy: 1 });

// Method to check if a distance falls within this commission range
deliveryBoyCommissionSchema.methods.isDistanceInRange = function(distance) {
  if (distance < this.minDistance) return false;
  if (this.maxDistance !== null && distance > this.maxDistance) return false;
  return true;
};

// Static method to find applicable commission rule for a distance
deliveryBoyCommissionSchema.statics.findApplicableRule = async function(distance) {
  const rules = await this.find({ status: true }).sort({ minDistance: 1 });
  
  for (const rule of rules) {
    if (rule.isDistanceInRange(distance)) {
      return rule;
    }
  }
  
  // If no exact match, find the nearest rule
  // For distances less than minimum, return the first rule
  // For distances greater than maximum, return the last rule (or unlimited rule)
  const firstRule = rules[0];
  const lastRule = rules[rules.length - 1];
  
  if (distance < firstRule.minDistance) {
    return firstRule;
  }
  
  // Find unlimited rule (maxDistance === null)
  const unlimitedRule = rules.find(r => r.maxDistance === null);
  if (unlimitedRule && distance > unlimitedRule.minDistance) {
    return unlimitedRule;
  }
  
  // Return last rule as fallback
  return lastRule || firstRule;
};

// Static method to calculate commission for a given distance
deliveryBoyCommissionSchema.statics.calculateCommission = async function(distance) {
  // Get all active rules sorted by minDistance (ascending)
  const rules = await this.find({ status: true }).sort({ minDistance: 1 });
  
  if (!rules || rules.length === 0) {
    throw new Error('No commission rules found');
  }
  
  // Find the applicable rule based on distance
  // Logic: Find the rule where distance falls within the range (minDistance <= distance <= maxDistance)
  // Or find the highest tier rule if distance exceeds all maxDistance limits
  let applicableRule = null;
  
  // First, try to find exact match (distance within rule's range)
  for (const rule of rules) {
    if (distance >= rule.minDistance) {
      // Check if distance is within this rule's range
      if (rule.maxDistance === null || rule.maxDistance === undefined) {
        // Unlimited range (e.g., 10+ km) - this is the highest tier
        applicableRule = rule;
        break;
      } else if (distance <= rule.maxDistance) {
        // Distance is within this rule's range (e.g., 4-10 km)
        applicableRule = rule;
        break;
      }
      // If distance > maxDistance, continue to next (higher) rule
      // Keep this rule as potential fallback
      applicableRule = rule;
    }
  }
  
  // If distance is less than all minDistances, use first rule (lowest tier)
  // This should typically be 0-4km with base payout only
  if (!applicableRule || distance < applicableRule.minDistance) {
    applicableRule = rules[0];
  }
  
  // If still no rule found (edge case), use first rule
  if (!applicableRule) {
    applicableRule = rules[0];
  }
  
  // Calculate commission
  // IMPORTANT: Base payout is ALWAYS given to delivery boy
  let basePayout = applicableRule.basePayout;
  let distanceCommission = 0;
  
  // Per km commission logic based on admin commission rules:
  // - Base payout: Always given (e.g., ₹15) - covers distance up to minDistance
  // - If distance > minDistance: Additional commission per km ONLY for the extra distance
  // Example scenarios (assuming minDistance = 4, commissionPerKm = 5, basePayout = 15):
  // - Distance = 4 km: commission = ₹15 (base only, 4 is not > 4)
  // - Distance = 5.81 km: commission = ₹15 + ((5.81 - 4) × ₹5) = ₹15 + ₹9.05 = ₹24.05
  // - Distance = 6 km: commission = ₹15 + ((6 - 4) × ₹5) = ₹15 + ₹10 = ₹25
  // - Distance = 2 km: commission = ₹15 (base only, 2 < 4)
  // - Distance = 10 km: commission = ₹15 + ((10 - 4) × ₹5) = ₹15 + ₹30 = ₹45
  if (distance > applicableRule.minDistance) {
    // Apply per km commission ONLY for the EXTRA distance above minDistance
    // Formula: (distance - minDistance) × commissionPerKm
    // Example: If minDistance = 4, commissionPerKm = 5, distance = 5.81
    // Then: (5.81 - 4) × 5 = 1.81 × 5 = ₹9.05 additional, total = ₹15 + ₹9.05 = ₹24.05
    const extraDistance = distance - applicableRule.minDistance;
    distanceCommission = extraDistance * applicableRule.commissionPerKm;
    console.log(`📊 Distance commission calculation: (${distance.toFixed(2)} - ${applicableRule.minDistance}) km × ₹${applicableRule.commissionPerKm}/km = ${extraDistance.toFixed(2)} km × ₹${applicableRule.commissionPerKm}/km = ₹${distanceCommission.toFixed(2)}`);
  } else {
    // If distance <= minDistance, only base payout is given (distanceCommission = 0)
    console.log(`📊 Distance ${distance.toFixed(2)} km ≤ minDistance ${applicableRule.minDistance} km, only base payout applies`);
  }
  
  const commission = basePayout + distanceCommission;
  
  console.log(`📊 Commission calculation for ${distance.toFixed(2)} km:`, {
    rule: applicableRule.name,
    minDistance: applicableRule.minDistance,
    maxDistance: applicableRule.maxDistance,
    basePayout: basePayout,
    commissionPerKm: applicableRule.commissionPerKm,
    perKmApplied: distance >= applicableRule.minDistance,
    distanceCommission: distanceCommission,
    totalCommission: commission
  });
  
  return {
    rule: applicableRule,
    commission: Math.round(commission * 100) / 100, // Round to 2 decimal places
    breakdown: {
      basePayout: basePayout,
      distance: distance,
      minDistance: applicableRule.minDistance,
      maxDistance: applicableRule.maxDistance,
      commissionPerKm: applicableRule.commissionPerKm,
      distanceCommission: distanceCommission,
      // Flag to indicate if per km commission was applied
      perKmApplied: distance >= applicableRule.minDistance
    }
  };
};

const DeliveryBoyCommission = mongoose.model('DeliveryBoyCommission', deliveryBoyCommissionSchema);

export default DeliveryBoyCommission;

