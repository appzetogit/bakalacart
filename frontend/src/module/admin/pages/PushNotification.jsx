import { useState, useMemo, useEffect, useRef } from "react"
import { Search, Download, ChevronDown, Bell, Edit, Trash2, Upload, Settings, Image as ImageIcon, X } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"

export default function PushNotification() {
  const [formData, setFormData] = useState({
    title: "",
    zone: "All",
    sendTo: "Customer",
    description: "",
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const fileInputRef = useRef(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [notifications, setNotifications] = useState([])
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)

  // Fetch initial data
  useEffect(() => {
    fetchNotifications()
    fetchZones()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getNotifications()
      if (response.data?.success) {
        setNotifications(response.data.data.notifications || [])
      }
    } catch (error) {
      console.error("Error fetching notifications:", error)
      toast.error("Failed to load notifications")
    } finally {
      setLoading(false)
    }
  }

  const fetchZones = async () => {
    try {
      const response = await adminAPI.getZones()
      if (response.data?.success) {
        setZones(response.data.data.zones || [])
      }
    } catch (error) {
      console.error("Error fetching zones:", error)
    }
  }

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return notifications
    }

    const query = searchQuery.toLowerCase().trim()
    return notifications.filter(notification =>
      notification.title?.toLowerCase().includes(query) ||
      notification.description?.toLowerCase().includes(query)
    )
  }, [notifications, searchQuery])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size must be less than 2MB")
        return
      }
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.title || !formData.description) {
      toast.error("Title and description are required")
      return
    }

    try {
      setSending(true)
      const submitData = new FormData()
      submitData.append("title", formData.title)
      submitData.append("zone", formData.zone)
      submitData.append("sendTo", formData.sendTo)
      submitData.append("description", formData.description)
      if (imageFile) {
        submitData.append("image", imageFile)
      }

      const response = await adminAPI.sendNotification(submitData)

      if (response.data?.success) {
        toast.success("Notification sent successfully!")
        handleReset()
        fetchNotifications()
      }
    } catch (error) {
      console.error("Error sending notification:", error)
      toast.error(error.response?.data?.message || "Failed to send notification")
    } finally {
      setSending(false)
    }
  }

  const handleReset = () => {
    setFormData({
      title: "",
      zone: "All",
      sendTo: "Customer",
      description: "",
    })
    removeImage()
  }

  const handleToggleStatus = async (id) => {
    try {
      const response = await adminAPI.toggleNotificationStatus(id)
      if (response.data?.success) {
        setNotifications(notifications.map(n =>
          n._id === id ? { ...n, status: !n.status } : n
        ))
        toast.success("Status updated")
      }
    } catch (error) {
      console.error("Status update failed:", error)
      toast.error("Failed to update status")
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this notification?")) {
      try {
        const response = await adminAPI.deleteNotification(id)
        if (response.data?.success) {
          setNotifications(notifications.filter(n => n._id !== id))
          toast.success("Notification deleted")
        }
      } catch (error) {
        console.error("Delete failed:", error)
        toast.error("Failed to delete notification")
      }
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Create New Notification Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-blue-600" />
            <h1 className="text-2xl font-bold text-slate-900">Push Notification</h1>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange("title", e.target.value)}
                  placeholder="Ex: Notification Title"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Zone
                </label>
                <select
                  value={formData.zone}
                  onChange={(e) => handleInputChange("zone", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="All">All Zones</option>
                  {zones.map(z => (
                    <option key={z._id} value={z.name}>{z.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Send To
                </label>
                <select
                  value={formData.sendTo}
                  onChange={(e) => handleInputChange("sendTo", e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                >
                  <option value="Customer">Customer</option>
                  <option value="Delivery Man">Delivery Man</option>
                  <option value="Restaurant">Restaurant</option>
                </select>
              </div>
            </div>

            {/* Notification Banner Upload */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-3">
                Notification banner
              </label>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer bg-slate-50"
                >
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-blue-600 mb-1">Click to Upload Image</p>
                  <p className="text-xs text-slate-500">Image format - jpg, png, jpeg, gif, webp (Max 2MB)</p>
                </div>
              ) : (
                <div className="relative w-full max-w-md aspect-[3/1] rounded-lg overflow-hidden border border-slate-200">
                  <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Ex: Notification Descriptions"
                rows={3}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                type="submit"
                disabled={sending}
                className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-md ${sending ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {sending ? 'Sending...' : 'Send Notification'}
              </button>
            </div>
          </form>
        </div>

        {/* Notification List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Notification History</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredNotifications.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Search by title"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">SI</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Image</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Zone</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Target</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-center text-[11px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-slate-500">Loading notifications...</td>
                  </tr>
                ) : filteredNotifications.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-10 text-center text-slate-500">No notifications found</td>
                  </tr>
                ) : filteredNotifications.map((notification, index) => (
                  <tr
                    key={notification._id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900 truncate block max-w-[150px]">{notification.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 truncate block max-w-[200px]">{notification.description}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {notification.image ? (
                        <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-100 shadow-sm bg-slate-50">
                          <img
                            src={notification.image}
                            alt={notification.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                          <ImageIcon className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                        {notification.zone || "All"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700">
                        {notification.target}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(notification._id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${notification.status ? "bg-green-500" : "bg-slate-300"
                          }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notification.status ? "translate-x-6" : "translate-x-1"
                            }`}
                        />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDelete(notification._id)}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
