"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// Types for compatibility with use-toast hook
export type ToastActionElement = React.ReactElement;

export interface ToastProps {
  id?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info", duration: number = 3000) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type, duration };
    
    setToasts((prev) => [...prev, newToast]);

    // 自动移除
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    }
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    showToast(message, "success", duration);
  }, [showToast]);

  const showError = useCallback((message: string, duration?: number) => {
    showToast(message, "error", duration);
  }, [showToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    showToast(message, "info", duration);
  }, [showToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    showToast(message, "warning", duration);
  }, [showToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "info":
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getBgColor = (type: ToastType) => {
    switch (type) {
      case "success":
        return "bg-green-500/10 border-green-500/30";
      case "error":
        return "bg-red-500/10 border-red-500/30";
      case "warning":
        return "bg-yellow-500/10 border-yellow-500/30";
      case "info":
      default:
        return "bg-blue-500/10 border-blue-500/30";
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      <div className="fixed inset-0 pointer-events-none z-[100] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 w-full max-w-md">
          <AnimatePresence>
            {toasts.map((toast) => (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`
                  pointer-events-auto
                  w-full
                  bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800
                  border border-gray-700/50
                  rounded-xl
                  shadow-2xl
                  backdrop-blur-xl
                  ${getBgColor(toast.type)}
                  p-4
                  flex items-start gap-3
                `}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(toast.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium leading-relaxed">
                    {toast.message}
                  </p>
                </div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="flex-shrink-0 text-gray-400 hover:text-white transition-colors p-1 -mt-1 -mr-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  );
};
