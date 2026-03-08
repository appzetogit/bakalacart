/**
 * Single-call app init for Flutter/mobile startup.
 * GET /api/app-init
 * Returns env (maps key), settings (company, logo, maintenance) in one response.
 * Use this instead of multiple parallel calls to avoid one failing and leaving the app spinning.
 */

import { successResponse } from '../utils/response.js';
import EnvironmentVariable from '../../modules/admin/models/EnvironmentVariable.js';
import BusinessSettings from '../../modules/admin/models/BusinessSettings.js';

export async function getAppInit(req, res) {
  try {
    const now = new Date();
    let env = { VITE_GOOGLE_MAPS_API_KEY: '' };
    let settings = {
      companyName: 'Bakalaa',
      logo: { url: '', publicId: '' },
      favicon: { url: '', publicId: '' },
      maintenanceMode: {
        user: { isEnabled: false },
        restaurantDelivery: { isEnabled: false }
      }
    };

    try {
      const envVars = await EnvironmentVariable.getOrCreate();
      const envData = envVars.toEnvObject();
      env = { VITE_GOOGLE_MAPS_API_KEY: envData.VITE_GOOGLE_MAPS_API_KEY || '' };
    } catch (e) {
      console.warn('[app-init] Env load failed, using defaults:', e?.message);
    }

    try {
      const biz = await BusinessSettings.getSettings();
      if (biz?.maintenanceMode?.user?.isEnabled) {
        const u = biz.maintenanceMode.user;
        let inWindow = true;
        if (u.startDate && now < new Date(u.startDate)) inWindow = false;
        if (u.endDate && now > new Date(u.endDate)) inWindow = false;
        settings.maintenanceMode.user.isEnabled = inWindow;
      }
      if (biz?.maintenanceMode?.restaurantDelivery?.isEnabled) {
        const r = biz.maintenanceMode.restaurantDelivery;
        let inWindow = true;
        if (r.startDate && now < new Date(r.startDate)) inWindow = false;
        if (r.endDate && now > new Date(r.endDate)) inWindow = false;
        settings.maintenanceMode.restaurantDelivery.isEnabled = inWindow;
      }
      settings.companyName = biz?.companyName || 'Bakalaa';
      settings.logo = biz?.logo || { url: '', publicId: '' };
      settings.favicon = biz?.favicon || { url: '', publicId: '' };
    } catch (e) {
      console.warn('[app-init] Settings load failed, using defaults:', e?.message);
    }

    return successResponse(res, 200, 'App init loaded', {
      env,
      settings,
      timestamp: now.toISOString()
    });
  } catch (err) {
    console.error('[app-init] Error:', err?.message);
    return successResponse(res, 200, 'App init loaded', {
      env: { VITE_GOOGLE_MAPS_API_KEY: '' },
      settings: {
        companyName: 'Bakalaa',
        logo: { url: '', publicId: '' },
        favicon: { url: '', publicId: '' },
        maintenanceMode: { user: { isEnabled: false }, restaurantDelivery: { isEnabled: false } }
      },
      timestamp: new Date().toISOString()
    });
  }
}
