import React from 'react'
import { Tag, X } from 'lucide-react'

interface TagLegendProps {
  availableTags: string[]
  selectedTags: Set<string>
  onTagToggle: (tag: string) => void
  onClearAll: () => void
  markerCounts?: Record<string, number> // Count of markers per tag
}

const TagLegend: React.FC<TagLegendProps> = ({
  availableTags,
  selectedTags,
  onTagToggle,
  onClearAll,
  markerCounts = {}
}) => {
  if (availableTags.length === 0) {
    return null
  }

  const hasActiveFilters = selectedTags.size > 0

  return (
    <div className="mb-4 pb-3 border-b border-gray-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-pink-600" />
          <span className="text-xs font-medium text-gray-700">Filter by tags</span>
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClearAll}
            className="text-xs text-pink-600 hover:text-pink-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {availableTags.map((tag) => {
          const isSelected = selectedTags.has(tag)
          const count = markerCounts[tag] || 0
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onTagToggle(tag)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                isSelected
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
              {count > 0 && (
                <span className={`ml-1.5 px-1 rounded ${
                  isSelected ? 'bg-pink-700' : 'bg-gray-200'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default TagLegend


