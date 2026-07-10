import { useState, useEffect, createContext, useContext, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`px-4 py-3 rounded-lg shadow-lg border cursor-pointer text-sm animate-slide-up ${
              toast.type === 'error' ? 'bg-red-900/90 border-red-700 text-red-200' :
              toast.type === 'warning' ? 'bg-yellow-900/90 border-yellow-700 text-yellow-200' :
              toast.type === 'success' ? 'bg-green-900/90 border-green-700 text-green-200' :
              'bg-blue-900/90 border-blue-700 text-blue-200'
            }`}
          >
            {toast.type === 'error' && '❌ '}
            {toast.type === 'warning' && '⚠️ '}
            {toast.type === 'success' && '✅ '}
            {toast.type === 'info' && 'ℹ️ '}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

// CSS for slide-up animation
const style = document.createElement('style');
style.textContent = `
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-slide-up { animation: slide-up 0.3s ease-out; }
`;
document.head.appendChild(style);
