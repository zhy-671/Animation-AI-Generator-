"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  itemName?: string; // e.g., "project", "scene", "character"
  isLoading?: boolean;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = "Delete Confirmation",
  description,
  itemName = "item",
  isLoading = false,
}: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const defaultDescription = `Are you sure you want to delete this ${itemName}? This action cannot be undone and all associated data will be permanently removed.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50 shadow-2xl p-0 overflow-hidden">
        {/* Decorative gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-transparent to-red-500/5 pointer-events-none" />
        
        <div className="relative p-6 space-y-6">
          <DialogHeader className="space-y-4">
            {/* Icon with animated background */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/10 border-2 border-red-500/30">
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>
              </div>
            </motion.div>

            <DialogTitle className="text-2xl font-bold text-white text-center tracking-tight">
              {title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-gray-300 text-center text-base leading-relaxed">
                {description || defaultDescription}
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Warning message */}
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300 leading-relaxed">
              This action is permanent and cannot be reversed. Please make sure you want to proceed.
            </p>
          </div>
        </div>

        {/* Footer with buttons */}
        <DialogFooter className="px-6 pb-6 pt-0 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600 transition-all"
          >
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold shadow-lg shadow-red-500/25 hover:shadow-red-500/40 transition-all group"
          >
            {isLoading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full"
                />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                Delete
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

