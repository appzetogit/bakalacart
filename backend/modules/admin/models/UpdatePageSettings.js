import mongoose from 'mongoose';

const appUpdateConfigSchema = new mongoose.Schema(
  {
    isEnabled: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      trim: true,
      default: 'Update Available'
    },
    message: {
      type: String,
      trim: true,
      default: 'A new version of the app is available. Please update to continue.'
    },
    buttonText: {
      type: String,
      trim: true,
      default: 'Update Now'
    },
    playStoreUrl: {
      type: String,
      trim: true,
      default: ''
    }
  },
  { _id: false }
);

const updatePageSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: appUpdateConfigSchema,
      default: () => ({})
    },
    restaurant: {
      type: appUpdateConfigSchema,
      default: () => ({})
    },
    delivery: {
      type: appUpdateConfigSchema,
      default: () => ({})
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null
    }
  },
  {
    timestamps: true
  }
);

updatePageSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();

  if (!settings) {
    settings = await this.create({});
  }

  return settings;
};

export default mongoose.model('UpdatePageSettings', updatePageSettingsSchema);
