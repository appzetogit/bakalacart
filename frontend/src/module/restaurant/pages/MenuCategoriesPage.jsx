import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion, AnimatePresence } from "framer-motion"
import { 
  ArrowLeft, 
  Plus, 
  X, 
  Edit2, 
  Trash2, 
  GripVertical,
  Loader2,
  Check,
  ArrowUp,
  ArrowDown
} from "lucide-react"
import { restaurantAPI } from "@/lib/api"
import { toast } from "sonner"

export default function MenuCategoriesPage() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    icon: '',
    color: '#000000'
  })

  // Fetch categories
  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const response = await restaurantAPI.getAllCategories()
      if (response.data.success) {
        setCategories(response.data.data.categories || [])
      }
    } catch (error) {
      console.error('Error fetching categories:', error)
      toast.error('Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = () => {
    setEditingCategory(null)
    setFormData({
      name: '',
      icon: '',
      color: '#000000'
    })
    setShowAddModal(true)
  }

  const handleEditCategory = (category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name || '',
      icon: category.icon || '',
      color: category.color || '#000000'
    })
    setShowAddModal(true)
  }

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      toast.error('Category name is required')
      return
    }

    try {
      // Prepare data to send (only name is required, backend will handle order)
      const categoryData = {
        name: formData.name.trim()
      }

      if (editingCategory) {
        // Update existing category
        await restaurantAPI.updateCategory(editingCategory._id || editingCategory.id, categoryData)
        toast.success('Category updated successfully')
      } else {
        // Create new category
        await restaurantAPI.createCategory(categoryData)
        toast.success('Category created successfully')
      }
      setShowAddModal(false)
      fetchCategories()
    } catch (error) {
      console.error('Error saving category:', error)
      if (error.code === 'ERR_NETWORK') {
        toast.error('Network error. Please check if backend server is running.')
      } else {
        toast.error(error.response?.data?.message || error.message || 'Failed to save category')
      }
    }
  }

  const handleDeleteCategory = async (category) => {
    if (!confirm(`Are you sure you want to delete "${category.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await restaurantAPI.deleteCategory(category._id || category.id)
      toast.success('Category deleted successfully')
      fetchCategories()
    } catch (error) {
      console.error('Error deleting category:', error)
      toast.error(error.response?.data?.message || 'Failed to delete category')
    }
  }

  const handleMoveCategory = async (index, direction) => {
    const newCategories = [...categories]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    
    if (targetIndex < 0 || targetIndex >= newCategories.length) return
    
    // Swap items
    const [movedItem] = newCategories.splice(index, 1)
    newCategories.splice(targetIndex, 0, movedItem)
    
    // Update state immediately
    setCategories(newCategories)
    
    try {
      // Backend expects array of { id, order }
      const reorderData = newCategories.map((cat, idx) => ({
        id: cat._id || cat.id,
        order: idx + 1
      }))
      
      await restaurantAPI.reorderCategories(reorderData)
      toast.success('Category order updated')
    } catch (error) {
      console.error('Error reordering categories:', error)
      toast.error('Failed to update order')
      fetchCategories() // Revert
    }
  }

  const handleToggleActive = async (category) => {
    try {
      await restaurantAPI.updateCategory(category._id || category.id, {
        isActive: !category.isActive
      })
      toast.success(`Category ${!category.isActive ? 'activated' : 'deactivated'}`)
      fetchCategories()
    } catch (error) {
      console.error('Error toggling category:', error)
      toast.error('Failed to update category')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Menu Categories</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Add Category Button */}
        <button
          onClick={handleAddCategory}
          className="w-full py-3 px-4 bg-black text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Category
        </button>

        {/* Categories List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">No categories yet</p>
            <p className="text-sm text-gray-400">Add your first category to organize your menu items</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((category) => (
              <motion.div
                key={category._id || category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="flex flex-col gap-1 items-center">
                    <button
                      onClick={() => handleMoveCategory(categories.indexOf(category), 'up')}
                      disabled={categories.indexOf(category) === 0}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleMoveCategory(categories.indexOf(category), 'down')}
                      disabled={categories.indexOf(category) === categories.length - 1}
                      className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      {!category.isActive && (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Inactive</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span>Items: {category.itemCount || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(category)}
                    className={`p-2 rounded-lg transition-colors ${
                      category.isActive
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={category.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEditCategory(category)}
                    className="p-2 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
                    className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                    title="Delete"
                    disabled={category.itemCount > 0}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Category Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingCategory ? 'Edit Category' : 'Add Category'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Starters, Main Course, Desserts"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="px-4 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 py-3 px-4 bg-black text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                >
                  {editingCategory ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

