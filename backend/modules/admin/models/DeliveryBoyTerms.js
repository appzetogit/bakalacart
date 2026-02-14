import mongoose from 'mongoose';

const deliveryBoyTermsSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Delivery Boy Terms & Conditions',
  },
  content: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
}, {
  timestamps: true,
});

// Ensure only one active terms exists
deliveryBoyTermsSchema.index({ isActive: 1 }, { unique: true, sparse: true });

const DeliveryBoyTerms = mongoose.model('DeliveryBoyTerms', deliveryBoyTermsSchema);

export default DeliveryBoyTerms;
