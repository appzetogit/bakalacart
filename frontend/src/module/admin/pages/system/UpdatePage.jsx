import { useEffect, useState } from "react"
import { Loader2, Save, Settings2 } from "lucide-react"
import { toast } from "sonner"
import apiClient from "@/lib/api/axios"

const APP_SECTIONS = [
  { key: "user", label: "User App" },
  { key: "restaurant", label: "Restaurant App" },
  { key: "delivery", label: "Delivery App" },
]

const DEFAULT_SECTION = {
  isEnabled: false,
  title: "Update Available",
  message: "A new version of the app is available. Please update to continue.",
  buttonText: "Update Now",
  playStoreUrl: "",
}

const createInitialForm = () => ({
  user: { ...DEFAULT_SECTION },
  restaurant: { ...DEFAULT_SECTION },
  delivery: { ...DEFAULT_SECTION },
})

export default function UpdatePage() {
  const [formData, setFormData] = useState(createInitialForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await apiClient.get("/admin/update-page")
        const data = response?.data?.data || {}

        setFormData({
          user: { ...DEFAULT_SECTION, ...(data.user || {}) },
          restaurant: { ...DEFAULT_SECTION, ...(data.restaurant || {}) },
          delivery: { ...DEFAULT_SECTION, ...(data.delivery || {}) },
        })
      } catch (error) {
        console.error("Failed to load update page settings:", error)
        toast.error("Failed to load update page settings")
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleFieldChange = (appKey, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [appKey]: {
        ...prev[appKey],
        [field]: value,
      },
    }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)

    try {
      await apiClient.put("/admin/update-page", formData)
      toast.success("Update page settings saved")
    } catch (error) {
      console.error("Failed to save update page settings:", error)
      toast.error("Failed to save update page settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-6 py-4 shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
          <span className="text-sm font-medium text-slate-700">Loading update page settings...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 lg:p-4">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Update Page</h1>
              <p className="text-sm text-slate-500">
                Manage the update popup for the user, restaurant, and delivery apps.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {APP_SECTIONS.map((section) => {
            const values = formData[section.key]

            return (
              <section
                key={section.key}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{section.label}</h2>
                    <p className="text-sm text-slate-500">
                      Control the popup copy and Play Store redirect for this app.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                    <span>{values.isEnabled ? "Enabled" : "Disabled"}</span>
                    <input
                      type="checkbox"
                      checked={values.isEnabled}
                      onChange={(e) => handleFieldChange(section.key, "isEnabled", e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Popup Title</label>
                    <input
                      type="text"
                      value={values.title}
                      onChange={(e) => handleFieldChange(section.key, "title", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Update Available"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Button Text</label>
                    <input
                      type="text"
                      value={values.buttonText}
                      onChange={(e) => handleFieldChange(section.key, "buttonText", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="Update Now"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Popup Message</label>
                    <textarea
                      rows={4}
                      value={values.message}
                      onChange={(e) => handleFieldChange(section.key, "message", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="A new version of the app is available. Please update to continue."
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">Play Store Link</label>
                    <input
                      type="url"
                      value={values.playStoreUrl}
                      onChange={(e) => handleFieldChange(section.key, "playStoreUrl", e.target.value)}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                      placeholder="https://play.google.com/store/apps/details?id=your.app"
                    />
                  </div>
                </div>
              </section>
            )
          })}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
