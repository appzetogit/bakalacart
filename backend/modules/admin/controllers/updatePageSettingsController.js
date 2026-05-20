import UpdatePageSettings from '../models/UpdatePageSettings.js';
import { asyncHandler } from '../../../shared/middleware/asyncHandler.js';
import { errorResponse, successResponse } from '../../../shared/utils/response.js';

const APP_KEYS = ['user', 'restaurant', 'delivery'];

const normalizeAppConfig = (config = {}, fallback = {}) => ({
  isEnabled: Boolean(config.isEnabled ?? fallback.isEnabled ?? false),
  title: String(config.title ?? fallback.title ?? 'Update Available').trim(),
  message: String(
    config.message ??
      fallback.message ??
      'A new version of the app is available. Please update to continue.'
  ).trim(),
  buttonText: String(config.buttonText ?? fallback.buttonText ?? 'Update Now').trim(),
  playStoreUrl: String(config.playStoreUrl ?? fallback.playStoreUrl ?? '').trim()
});

const toResponsePayload = (settings) => ({
  _id: settings._id,
  user: normalizeAppConfig(settings.user),
  restaurant: normalizeAppConfig(settings.restaurant),
  delivery: normalizeAppConfig(settings.delivery),
  updatedAt: settings.updatedAt,
  createdAt: settings.createdAt
});

export const getUpdatePageSettingsPublic = asyncHandler(async (req, res) => {
  const settings = await UpdatePageSettings.getSettings();

  return successResponse(
    res,
    200,
    'Update page settings retrieved successfully',
    toResponsePayload(settings)
  );
});

export const getUpdatePageSettings = asyncHandler(async (req, res) => {
  const settings = await UpdatePageSettings.getSettings();

  return successResponse(
    res,
    200,
    'Update page settings retrieved successfully',
    toResponsePayload(settings)
  );
});

export const updateUpdatePageSettings = asyncHandler(async (req, res) => {
  try {
    const settings = await UpdatePageSettings.getSettings();
    const payload = req.body || {};

    APP_KEYS.forEach((key) => {
      settings.set(key, normalizeAppConfig(payload[key], settings[key]));
    });

    if (req.admin?._id) {
      settings.updatedBy = req.admin._id;
    }

    await settings.save();

    return successResponse(
      res,
      200,
      'Update page settings updated successfully',
      toResponsePayload(settings)
    );
  } catch (error) {
    console.error('Error updating update page settings:', error);
    return errorResponse(res, 500, 'Failed to update update page settings');
  }
});
