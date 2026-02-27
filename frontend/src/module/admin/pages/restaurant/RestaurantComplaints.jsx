import { useState, useEffect } from "react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Search, Filter, AlertCircle, CheckCircle, Clock, XCircle, FileText } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
]

const COMPLAINT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'food_quality', label: 'Food Quality' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'missing_item', label: 'Missing Item' },
  { value: 'delivery_issue', label: 'Delivery Issue' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'service', label: 'Service' },
  { value: 'other', label: 'Other' },
]

export default function RestaurantComplaints() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0
  })
  const [filters, setFilters] = useState({
    status: 'all',
    complaintType: 'all',
    search: '',
    page: 1,
    limit: 50
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 1
  })
  const [searchTerm, setSearchTerm] = useState(filters.search)
  const [selectedComplaint, setSelectedComplaint] = useState(null)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [updateData, setUpdateData] = useState({
    status: '',
    adminResponse: '',
    internalNotes: ''
  })
  const [updating, setUpdating] = useState(false)

  // Instant search
  useEffect(() => {
    setFilters(prev => ({ ...prev, search: searchTerm, page: 1 }))
  }, [searchTerm])

  useEffect(() => {
    fetchComplaints()
  }, [filters])

  const fetchComplaints = async () => {
    try {
      setLoading(true)
      const params = {
        page: filters.page,
        limit: filters.limit,
      }
      if (filters.status && filters.status !== 'all') params.status = filters.status
      if (filters.complaintType && filters.complaintType !== 'all') params.complaintType = filters.complaintType
      if (filters.search) params.search = filters.search

      const response = await adminAPI.getRestaurantComplaints(params)
      if (response?.data?.success) {
        setComplaints(response.data.data.complaints || [])
        setStats(response.data.data.stats || stats)
        setPagination(response.data.data.pagination || pagination)
      }
    } catch (error) {
      console.error('Error fetching complaints:', error)
      toast.error('Failed to fetch complaints')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = (complaint) => {
    setSelectedComplaint(complaint)
    setUpdateData({
      status: complaint.status,
      adminResponse: complaint.adminResponse || '',
      internalNotes: complaint.internalNotes || ''
    })
    setShowUpdateModal(true)
  }

  const onUpdateSubmit = async () => {
    try {
      setUpdating(true)
      const response = await adminAPI.updateRestaurantComplaintStatus(
        selectedComplaint._id,
        updateData.status,
        updateData.adminResponse,
        updateData.internalNotes
      )

      if (response?.data?.success) {
        toast.success('Complaint status updated successfully')
        setShowUpdateModal(false)
        fetchComplaints()
      }
    } catch (error) {
      console.error('Error updating complaint:', error)
      toast.error(error.response?.data?.message || 'Failed to update complaint')
    } finally {
      setUpdating(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-600" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Restaurant Complaints</h1>
        <p className="text-sm text-gray-500 mt-1">Manage and track customer complaints</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by order, customer, restaurant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.stopPropagation();
                }
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <Select value={filters.status || 'all'} onValueChange={(value) => setFilters({ ...filters, status: value, page: 1 })}>
            <SelectTrigger>
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.complaintType || 'all'} onValueChange={(value) => setFilters({ ...filters, complaintType: value, page: 1 })}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              {COMPLAINT_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Complaints List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Loading complaints...</p>
          </div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No complaints found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {complaints.map((complaint) => (
              <div key={complaint._id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getStatusIcon(complaint.status)}
                      <h3 className="font-semibold text-gray-900">{complaint.subject}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs text-gray-500">Order</p>
                        <p className="font-medium">#{complaint.orderNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Customer</p>
                        <p className="font-medium">{complaint.customerName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Restaurant</p>
                        <p className="font-medium">{complaint.restaurantName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Type</p>
                        <p className="font-medium capitalize">{complaint.complaintType.replace('_', ' ')}</p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleUpdateStatus(complaint)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                  >
                    Update Status
                  </button>
                </div>
                <p className="text-sm text-gray-700 mb-3">{complaint.description}</p>

                <div className="flex flex-wrap gap-3">
                  {complaint.restaurantResponse && (
                    <div className="flex-1 min-w-[300px] bg-blue-50 rounded p-3">
                      <p className="text-xs font-semibold text-blue-700 mb-1">Restaurant Response:</p>
                      <p className="text-sm text-blue-800">{complaint.restaurantResponse}</p>
                    </div>
                  )}
                  {complaint.adminResponse && (
                    <div className="flex-1 min-w-[300px] bg-green-50 rounded p-3">
                      <p className="text-xs font-semibold text-green-700 mb-1">Admin Response:</p>
                      <p className="text-sm text-green-800">{complaint.adminResponse}</p>
                    </div>
                  )}
                </div>

                {complaint.internalNotes && (
                  <div className="mt-3 bg-gray-50 rounded p-2 border border-dashed border-gray-300">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Internal Notes (Private):</p>
                    <p className="text-xs text-gray-600">{complaint.internalNotes}</p>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </p>
                  <div className={cn("px-2 py-1 rounded text-[10px] font-bold uppercase", getStatusColor(complaint.status))}>
                    {complaint.status.replace('_', ' ')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} complaints
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
              disabled={filters.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
              disabled={filters.page >= pagination.pages}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && selectedComplaint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Update Complaint Status</h2>
              <button onClick={() => setShowUpdateModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Subject</p>
                <p className="text-sm font-medium text-gray-900">{selectedComplaint.subject}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Update Status
                </label>
                <Select value={updateData.status} onValueChange={(value) => setUpdateData({ ...updateData, status: value })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {STATUS_OPTIONS.filter(o => o.value !== 'all').map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Admin Response
                </label>
                <textarea
                  value={updateData.adminResponse}
                  onChange={(e) => setUpdateData({ ...updateData, adminResponse: e.target.value })}
                  placeholder="Type your response to the customer/restaurant..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px] text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Internal Notes (Private)
                </label>
                <textarea
                  value={updateData.internalNotes}
                  onChange={(e) => setUpdateData({ ...updateData, internalNotes: e.target.value })}
                  placeholder="Internal team notes (not visible to others)..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent min-h-[80px] text-sm bg-gray-50"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onUpdateSubmit}
                  disabled={updating}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {updating ? 'Updating...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
