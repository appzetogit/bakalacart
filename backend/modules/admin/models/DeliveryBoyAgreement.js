import mongoose from 'mongoose';

const deliveryBoyAgreementSchema = new mongoose.Schema({
  title: {
    type: String,
    default: 'Delivery Boy Agreement',
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

// Ensure only one active agreement exists
deliveryBoyAgreementSchema.index({ isActive: 1 }, { unique: true, sparse: true });

const DeliveryBoyAgreement = mongoose.model('DeliveryBoyAgreement', deliveryBoyAgreementSchema);

export default DeliveryBoyAgreement;
