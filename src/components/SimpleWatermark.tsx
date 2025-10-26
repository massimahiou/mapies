import React, { useState } from 'react'
import CuteNotification from './CuteNotification'

const SimpleWatermark: React.FC = () => {
  const [showNotification, setShowNotification] = useState(false)

  return (
    <>
      <div 
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '8px 12px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          color: '#374151',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(8px)',
          transition: 'all 0.2s ease'
        }}
        onClick={() => setShowNotification(true)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)'
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'
        }}
        title="Click to learn about upgrading"
      >
        <img 
          src="https://firebasestorage.googleapis.com/v0/b/mapies.firebasestorage.app/o/assets%2Fpinz_logo.png?alt=media&token=5ed95809-fe92-4528-8852-3ca03af0b1b5"
          alt="Pinz Logo"
          style={{ height: '16px', width: 'auto' }}
        />
        <span>Powered by Pinz</span>
        <span style={{ color: '#ff3670', fontSize: '12px' }}>→</span>
      </div>

      <CuteNotification 
        isOpen={showNotification}
        onClose={() => setShowNotification(false)}
      />
    </>
  )
}

export default SimpleWatermark
