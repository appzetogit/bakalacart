import { useEffect, useMemo, useState } from "react"
import { ExternalLink, X } from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/api/axios"

const DEFAULT_COPY = {
  title: "Update Available",
  message: "A new version of the app is available. Please update to continue.",
  buttonText: "Update Now",
}

export default function AppUpdatePopup({ appKey }) {
  const [config, setConfig] = useState(null)
  const [isOpen, setIsOpen] = useState(false)
  const storageKey = useMemo(() => `app_update_popup_dismissed_${appKey}`, [appKey])

  useEffect(() => {
    let isMounted = true

    const fetchSettings = async () => {
      try {
        const response = await apiClient.get("/update-page/public")
        const payload = response?.data?.data
        const appConfig = payload?.[appKey]

        if (!isMounted || !appConfig) {
          return
        }

        const normalizedConfig = {
          title: appConfig.title || DEFAULT_COPY.title,
          message: appConfig.message || DEFAULT_COPY.message,
          buttonText: appConfig.buttonText || DEFAULT_COPY.buttonText,
          playStoreUrl: appConfig.playStoreUrl || "",
          isEnabled: Boolean(appConfig.isEnabled),
          updatedAt: payload?.updatedAt || "",
        }

        setConfig(normalizedConfig)

        if (!normalizedConfig.isEnabled || !normalizedConfig.playStoreUrl) {
          return
        }

        const lastDismissedAt = localStorage.getItem(storageKey)
        if (lastDismissedAt && lastDismissedAt === normalizedConfig.updatedAt) {
          return
        }

        setIsOpen(true)
      } catch (error) {
        console.error(`Failed to fetch update popup settings for ${appKey}:`, error)
      }
    }

    fetchSettings()

    return () => {
      isMounted = false
    }
  }, [appKey, storageKey])

  const handleClose = () => {
    if (config?.updatedAt) {
      localStorage.setItem(storageKey, config.updatedAt)
    }
    setIsOpen(false)
  }

  const handleUpdate = () => {
    if (!config?.playStoreUrl) {
      return
    }

    const url = config.playStoreUrl

    try {
      const capacitorBrowser = window?.Capacitor?.Plugins?.Browser
      if (capacitorBrowser?.open) {
        capacitorBrowser.open({ url })
        return
      }

      const cordovaInAppBrowser = window?.cordova?.InAppBrowser
      if (cordovaInAppBrowser?.open) {
        cordovaInAppBrowser.open(url, "_system", "location=yes")
        return
      }

      const popup = window.open(url, "_blank", "noopener,noreferrer")
      if (popup) {
        popup.opener = null
        return
      }

      toast.error("Could not open the Play Store link in an external browser.")
    } catch (error) {
      console.error(`Failed to open update link for ${appKey}:`, error)
      toast.error("Could not open the Play Store link in an external browser.")
    }
  }

  if (!isOpen || !config) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close update popup"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
          <ExternalLink className="h-5 w-5" />
        </div>

        <h2 className="text-2xl font-bold text-slate-900">{config.title}</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">{config.message}</p>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Later
          </button>
          <button
            type="button"
            onClick={handleUpdate}
            className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            {config.buttonText}
          </button>
        </div>
      </div>
    </div>
  )
}
