import { useState, useMemo, useEffect } from "react"
import { 
  Search, Plus, Edit, Trash2, ArrowUpDown, 
  DollarSign, Loader2, X, IndianRupee, MapPin
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminAPI } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { toast } from "sonner"

export default function DeliveryBoyCommission() {
  const [searchQuery, setSearchQuery] = useState("")
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedCommission, setSelectedCommission] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    minDistance: "",
    maxDistance: "",
    commissionPerKm: "",
    basePayout: "",
  })
  const [formErrors, setFormErrors] = useState({})
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    name: true,
    minDistance: true,
    maxDistance: true,
    commissionPerKm: true,
    basePayout: true,
    status: true,
    actions: true,
  })

  const filteredCommissions = useMemo(() => {
    if (!searchQuery.trim()) {
      return commissions
    }
    
    const query = searchQuery.toLowerCase().trim()
    return commissions.filter(commission =>
      commission.name?.toLowerCase().includes(query) ||
      commission.minDistance?.toString().includes(query) ||
      commission.maxDistance?.toString().includes(query) ||
      commission.commissionPerKm?.toString().includes(query) ||
      commission.basePayout?.toString().includes(query)
    )
  }, [commissions, searchQuery])

  // Fetch data on component mount
  useEffect(() => {
    fetchCommissions()
  }, [])

  const fetchCommissions = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryBoyCommissions({})
      
      let commissionsData = null
      if (response?.data?.success && response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.commissions) {
        commissionsData = response.data.commissions
      } else if (response?.data?.data && Array.isArray(response.data.data)) {
        commissionsData = response.data.data
      }
      
      if (commissionsData && Array.isArray(commissionsData)) {
        setCommissions(commissionsData)
      } else {
        setCommissions([])
      }
    } catch (error) {
      console.error('Error fetching commissions:', error)
      
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        toast.error(`Cannot connect to backend server. Please ensure the backend is running on ${API_BASE_URL.replace('/api', '')}`)
      } else {
        toast.error(error.response?.data?.message || 'Failed to fetch commission rules')
      }
      setCommissions([])
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = () => {
    setSelectedCommission(null)
    setFormData({
      name: "",
      minDistance: "",
      maxDistance: "",
      commissionPerKm: "",
      basePayout: "",
    })
    setFormErrors({})
    setIsAddEditOpen(true)
  }

  const handleEdit = async (commission) => {
    try {
      setLoading(true)
      const response = await adminAPI.getDeliveryBoyCommissionById(commission._id)
      
      let commissionData = null
      if (response?.data?.success && response?.data?.data?.commission) {
        commissionData = response.data.data.commission
      } else if (response?.data?.data) {
        commissionData = response.data.data
      } else if (response?.data?.commission) {
        commissionData = response.data.commission
      }

      if (commissionData) {
        setSelectedCommission(commissionData)
        setFormData({
          name: commissionData.name || "",
          minDistance: commissionData.minDistance?.toString() || "",
          maxDistance: commissionData.maxDistance === null || commissionData.maxDistance === undefined ? "" : commissionData.maxDistance.toString(),
          commissionPerKm: commissionData.commissionPerKm?.toString() || "",
          basePayout: commissionData.basePayout?.toString() || "",
        })
        setFormErrors({})
        setIsAddEditOpen(true)
      }
    } catch (error) {
      console.error('Error fetching commission:', error)
      toast.error(error.response?.data?.message || 'Failed to load commission')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (commission) => {
    setSelectedCommission(commission)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCommission) return

    try {
      setDeleting(true)
      await adminAPI.deleteDeliveryBoyCommission(selectedCommission._id)
      await fetchCommissions()
      toast.success('Commission rule deleted successfully')
      setIsDeleteOpen(false)
      setSelectedCommission(null)
    } catch (error) {
      console.error('Error deleting commission:', error)
      toast.error(error.response?.data?.message || 'Failed to delete commission rule')
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleStatus = async (commission) => {
    try {
      await adminAPI.toggleDeliveryBoyCommissionStatus(commission._id)
      await fetchCommissions()
      toast.success(`Commission rule ${commission.status ? 'deactivated' : 'activated'} successfully`)
    } catch (error) {
      console.error('Error toggling status:', error)
      toast.error(error.response?.data?.message || 'Failed to update status')
    }
  }

  const validateForm = () => {
    const errors = {}
    
    if (!formData.name || !formData.name.trim()) {
      errors.name = "Name is required"
    }

    if (!formData.minDistance || parseFloat(formData.minDistance) < 0) {
      errors.minDistance = "Minimum distance is required and must be 0 or greater"
    }

    if (formData.maxDistance && formData.maxDistance.trim() !== "") {
      const maxDist = parseFloat(formData.maxDistance)
      const minDist = parseFloat(formData.minDistance)
      if (isNaN(maxDist) || maxDist <= minDist) {
        errors.maxDistance = "Maximum distance must be greater than minimum distance"
      }
    }

    if (!formData.commissionPerKm || parseFloat(formData.commissionPerKm) < 0) {
      errors.commissionPerKm = "Commission per km is required and must be 0 or greater"
    }

    if (!formData.basePayout || parseFloat(formData.basePayout) < 0) {
      errors.basePayout = "Base payout is required and must be 0 or greater"
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the errors in the form")
      return
    }

    try {
      setSaving(true)
      
      const payload = {
        name: formData.name.trim(),
        minDistance: parseFloat(formData.minDistance),
        maxDistance: formData.maxDistance && formData.maxDistance.trim() !== "" ? parseFloat(formData.maxDistance) : null,
        commissionPerKm: parseFloat(formData.commissionPerKm),
        basePayout: parseFloat(formData.basePayout),
      }

      if (selectedCommission) {
        await adminAPI.updateDeliveryBoyCommission(selectedCommission._id, payload)
        toast.success('Commission rule updated successfully')
      } else {
        await adminAPI.createDeliveryBoyCommission(payload)
        toast.success('Commission rule created successfully')
      }

      await fetchCommissions()
      setIsAddEditOpen(false)
      setSelectedCommission(null)
      setFormData({
        name: "",
        minDistance: "",
        maxDistance: "",
        commissionPerKm: "",
        basePayout: "",
      })
    } catch (error) {
      console.error('Error saving commission:', error)
      toast.error(error.response?.data?.message || 'Failed to save commission rule')
    } finally {
      setSaving(false)
    }
  }

  const columnsConfig = {
    si: "Serial Number",
    name: "Name",
    minDistance: "Min Distance (km)",
    maxDistance: "Max Distance (km)",
    commissionPerKm: "Commission/Km (₹)",
    basePayout: "Base Payout (₹)",
    status: "Status",
    actions: "Actions",
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Delivery Boy Commission</h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredCommissions.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={handleAdd}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2 transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                Add Commission Rule
              </button>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className="relative flex-1 sm:flex-initial min-w-[250px]">
              <input
                type="text"
                placeholder="Search by name, distance, or commission..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {visibleColumns.si && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        <div className="flex items-center gap-2">
                          <span>S.No</span>
                          <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                        </div>
                      </th>
                    )}
                    {visibleColumns.name && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Name
                      </th>
                    )}
                    {visibleColumns.minDistance && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Min Distance (km)
                      </th>
                    )}
                    {visibleColumns.maxDistance && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Max Distance (km)
                      </th>
                    )}
                    {visibleColumns.commissionPerKm && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Commission/Km (₹)
                      </th>
                    )}
                    {visibleColumns.basePayout && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Base Payout (₹)
                      </th>
                    )}
                    {visibleColumns.status && (
                      <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    {visibleColumns.actions && (
                      <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                        No commission rules found
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((commission, index) => (
                      <tr key={commission._id} className="hover:bg-slate-50 transition-colors">
                        {visibleColumns.si && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-700">{commission.sl || index + 1}</span>
                          </td>
                        )}
                        {visibleColumns.name && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-blue-600">
                              {commission.name || '-'}
                            </span>
                          </td>
                        )}
                        {visibleColumns.minDistance && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">{commission.minDistance || '0'}</span>
                          </td>
                        )}
                        {visibleColumns.maxDistance && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-slate-700">
                              {commission.maxDistance === null || commission.maxDistance === undefined ? 'Unlimited' : commission.maxDistance}
                            </span>
                          </td>
                        )}
                        {visibleColumns.commissionPerKm && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-900 flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" />
                              {commission.commissionPerKm || '0'}
                            </span>
                          </td>
                        )}
                        {visibleColumns.basePayout && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-slate-900 flex items-center gap-1">
                              <IndianRupee className="w-3 h-3" />
                              {commission.basePayout || '0'}
                            </span>
                          </td>
                        )}
                        {visibleColumns.status && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleToggleStatus(commission)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                                commission.status ? "bg-blue-600" : "bg-slate-300"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  commission.status ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </button>
                          </td>
                        )}
                        {visibleColumns.actions && (
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleEdit(commission)}
                                className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(commission)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {selectedCommission ? "Edit Commission Rule" : "Add Commission Rule"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.name ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., Short Distance (0-2 km)"
              />
              {formErrors.name && (
                <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>
              )}
            </div>

            {/* Min Distance */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Minimum Distance (km) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.minDistance}
                onChange={(e) => setFormData(prev => ({ ...prev, minDistance: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.minDistance ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., 0"
              />
              {formErrors.minDistance && (
                <p className="text-xs text-red-500 mt-1">{formErrors.minDistance}</p>
              )}
            </div>

            {/* Max Distance */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Maximum Distance (km) <span className="text-slate-400 font-normal">(Leave empty for unlimited)</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.maxDistance}
                onChange={(e) => setFormData(prev => ({ ...prev, maxDistance: e.target.value }))}
                className={`w-full px-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  formErrors.maxDistance ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., 2 (or leave empty for unlimited)"
              />
              {formErrors.maxDistance && (
                <p className="text-xs text-red-500 mt-1">{formErrors.maxDistance}</p>
              )}
              <p className="text-xs text-slate-500 mt-1">Leave empty to set unlimited maximum distance</p>
            </div>

            {/* Commission Per Km */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Commission Per Kilometer (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.commissionPerKm}
                  onChange={(e) => setFormData(prev => ({ ...prev, commissionPerKm: e.target.value }))}
                  className={`w-full pl-10 pr-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.commissionPerKm ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="e.g., 5.00"
                />
              </div>
              {formErrors.commissionPerKm && (
                <p className="text-xs text-red-500 mt-1">{formErrors.commissionPerKm}</p>
              )}
            </div>

            {/* Base Payout */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Base Payout (₹) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.basePayout}
                  onChange={(e) => setFormData(prev => ({ ...prev, basePayout: e.target.value }))}
                  className={`w-full pl-10 pr-3 py-2 text-sm border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    formErrors.basePayout ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="e.g., 10.00"
                />
              </div>
              {formErrors.basePayout && (
                <p className="text-xs text-red-500 mt-1">{formErrors.basePayout}</p>
              )}
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setIsAddEditOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {selectedCommission ? "Update" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
            <DialogTitle className="text-lg font-semibold text-slate-900">Delete Commission Rule</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete the commission rule <span className="font-semibold text-slate-900">"{selectedCommission?.name}"</span>? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
