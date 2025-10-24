import React, { createContext, useContext, useState, useCallback } from 'react'
import Toast from '../components/Toast'

interface ToastMessage {
  id: string
  type: 'warning' | 'success' | 'error' | 'info'
  title: string
  message: string
  duration?: number
}

interface ToastContextType {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void
  hideToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9)
    const newToast: ToastMessage = { ...toast, id }
    
    setToasts(prev => [...prev, newToast])
  }, [])

  const hideToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[10000] space-y-2">
        {toasts.map((toast, index) => (
          <div
            key={toast.id}
            className="transform transition-all duration-300 ease-in-out"
            style={{
              transform: `translateY(${index * 8}px)`,
              zIndex: 10000 - index
            }}
          >
            <Toast
              isVisible={true}
              onClose={() => hideToast(toast.id)}
              type={toast.type}
              title={toast.title}
              message={toast.message}
              duration={toast.duration}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
