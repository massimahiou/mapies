import React, { useState } from 'react'
import { Plus, X, Edit2, Check, Trash2, Tag } from 'lucide-react'
import { addTagToMap, removeTagFromMap, updateTagName } from '../firebase/maps'
import { useToast } from '../contexts/ToastContext'

interface TagManagementProps {
  userId: string
  mapId: string
  currentTags: string[]
  onTagsChange: (tags: string[]) => void
}

const TagManagement: React.FC<TagManagementProps> = ({
  userId,
  mapId,
  currentTags,
  onTagsChange
}) => {
  const { showToast } = useToast()
  const [newTagName, setNewTagName] = useState('')
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isRemoving, setIsRemoving] = useState<string | null>(null)

  const handleAddTag = async () => {
    if (!newTagName.trim()) return
    
    setIsAdding(true)
    try {
      await addTagToMap(userId, mapId, newTagName.trim())
      onTagsChange([...currentTags, newTagName.trim()])
      setNewTagName('')
      showToast({
        type: 'success',
        title: 'Tag Added',
        message: `Tag "${newTagName.trim()}" has been added`
      })
    } catch (error: any) {
      console.error('Error adding tag:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: error.message || 'Failed to add tag'
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleRemoveTag = async (tagName: string) => {
    if (!window.confirm(`Remove tag "${tagName}"? This will not remove it from markers.`)) {
      return
    }
    
    setIsRemoving(tagName)
    try {
      await removeTagFromMap(userId, mapId, tagName, false)
      onTagsChange(currentTags.filter(tag => tag !== tagName))
      showToast({
        type: 'success',
        title: 'Tag Removed',
        message: `Tag "${tagName}" has been removed`
      })
    } catch (error) {
      console.error('Error removing tag:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to remove tag'
      })
    } finally {
      setIsRemoving(null)
    }
  }

  const startEditing = (tagName: string) => {
    setEditingTag(tagName)
    setEditingName(tagName)
  }

  const cancelEditing = () => {
    setEditingTag(null)
    setEditingName('')
  }

  const handleSaveEdit = async () => {
    if (!editingTag || !editingName.trim() || editingName.trim() === editingTag) {
      cancelEditing()
      return
    }
    
    try {
      await updateTagName(userId, mapId, editingTag, editingName.trim())
      const updatedTags = currentTags.map(tag => tag === editingTag ? editingName.trim() : tag)
      onTagsChange(updatedTags)
      cancelEditing()
      showToast({
        type: 'success',
        title: 'Tag Updated',
        message: `Tag renamed to "${editingName.trim()}"`
      })
    } catch (error) {
      console.error('Error updating tag:', error)
      showToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to update tag'
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-5 h-5 text-pink-600" />
        <h3 className="text-lg font-semibold text-gray-900">Tags</h3>
      </div>
      
      <p className="text-sm text-gray-600 mb-4">
        Create tags to categorize and filter your markers. Each marker can have multiple tags.
      </p>

      {/* Add new tag */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
          placeholder="Enter tag name..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
          disabled={isAdding}
        />
        <button
          onClick={handleAddTag}
          disabled={!newTagName.trim() || isAdding}
          className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Tags list */}
      {currentTags.length === 0 ? (
        <div className="text-sm text-gray-500 text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
          No tags yet. Create your first tag above.
        </div>
      ) : (
        <div className="space-y-2">
          {currentTags.map((tag) => (
            <div
              key={tag}
              className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-lg hover:border-pink-300 transition-colors"
            >
              {editingTag === tag ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleSaveEdit()
                      if (e.key === 'Escape') cancelEditing()
                    }}
                    className="flex-1 px-2 py-1 border border-pink-300 rounded focus:outline-none focus:ring-2 focus:ring-pink-500"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEdit}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                    title="Save"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={cancelEditing}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded transition-colors"
                    title="Cancel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium text-gray-900">{tag}</span>
                  <button
                    onClick={() => startEditing(tag)}
                    className="p-1.5 text-gray-400 hover:text-pink-600 hover:bg-pink-50 rounded transition-colors"
                    title="Edit tag"
                    disabled={isRemoving === tag}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Remove tag"
                    disabled={isRemoving === tag}
                  >
                    {isRemoving === tag ? (
                      <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default TagManagement

