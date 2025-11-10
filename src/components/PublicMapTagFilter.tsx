import React, { useState } from 'react'
import { Tag, X, ChevronDown, ChevronUp } from 'lucide-react'

interface PublicMapTagFilterProps {
  availableTags: string[]
  selectedTags: Set<string>
  onTagToggle: (tag: string) => void
  onClearAll: () => void
  markerCounts?: Record<string, number>
  mapSettings: {
    searchBarBackgroundColor: string
    searchBarTextColor: string
  }
}

const PublicMapTagFilter: React.FC<PublicMapTagFilterProps> = ({
  availableTags,
  selectedTags,
  onTagToggle,
  onClearAll,
  markerCounts = {},
  mapSettings
}) => {
  const [isExpanded, setIsExpanded] = useState(true)

  if (availableTags.length === 0) {
    return null
  }

  const hasActiveFilters = selectedTags.size > 0

  return (
    <div className="mb-0 transition-all duration-200 ease-in-out">
      {/* Collapsible Header - Compact */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-white/50 transition-all duration-200"
        style={{ backgroundColor: hasActiveFilters ? 'rgba(236, 72, 153, 0.1)' : 'transparent' }}
      >
        <div className="flex items-center gap-1.5">
          <Tag className={`w-3.5 h-3.5 transition-colors duration-200 ${hasActiveFilters ? 'text-pink-600' : 'text-gray-500'}`} />
          <span className="text-xs font-medium" style={{ color: mapSettings.searchBarTextColor }}>
            Filter by tags
          </span>
          {hasActiveFilters && (
            <span className="px-1.5 py-0.5 bg-pink-600 text-white text-[10px] font-semibold rounded-full min-w-[18px] text-center">
              {selectedTags.size}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasActiveFilters && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onClearAll()
              }}
              className="p-0.5 text-pink-600 hover:text-pink-700 hover:bg-pink-50 rounded transition-colors"
              title="Clear filters"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <div className="transition-transform duration-200">
            {isExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expandable Content - Compact with smooth animation */}
      <div 
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="mt-1.5 p-2 rounded-md bg-white/80 backdrop-blur-sm border border-gray-200">
          <div className="flex flex-wrap gap-1">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.has(tag)
              const count = markerCounts[tag] || 0
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onTagToggle(tag)}
                  className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                    isSelected
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                  {count > 0 && (
                    <span className={`ml-1 px-1 rounded text-[9px] ${
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
      </div>
    </div>
  )
}

export default PublicMapTagFilter

