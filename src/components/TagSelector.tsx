import React from 'react'
import { Tag } from 'lucide-react'

interface TagSelectorProps {
  availableTags: string[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  disabled?: boolean
}

const TagSelector: React.FC<TagSelectorProps> = ({
  availableTags,
  selectedTags,
  onTagsChange,
  disabled = false
}) => {
  const toggleTag = (tag: string) => {
    if (disabled) return
    
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  if (availableTags.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-2">
        No tags available. Create tags in the Edit tab first.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        <Tag className="w-4 h-4 inline mr-1 text-pink-600" />
        Tags
      </label>
      <div className="flex flex-wrap gap-2">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              disabled={disabled}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-pink-600 text-white hover:bg-pink-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {tag}
            </button>
          )
        })}
      </div>
      {selectedTags.length > 0 && (
        <p className="text-xs text-gray-500 mt-2">
          {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )
}

export default TagSelector


