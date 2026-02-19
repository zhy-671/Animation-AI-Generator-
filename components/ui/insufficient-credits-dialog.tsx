"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Diamond, AlertCircle, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

interface InsufficientCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requiredCredits: number;
  currentBalance: number;
  action?: string; // e.g., "generate video", "generate image", "generate story script"
}

export function InsufficientCreditsDialog({
  open,
  onOpenChange,
  requiredCredits,
  currentBalance,
  action = "complete this action",
}: InsufficientCreditsDialogProps) {
  const router = useRouter();
  const shortfall = Math.max(0, requiredCredits - currentBalance);

  const handleGoToPricing = () => {
    onOpenChange(false);
    router.push("/pricing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 border-gray-700/50 shadow-2xl p-0 overflow-hidden">
        {/* Decorative gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-yellow-500/5 pointer-events-none" />
        
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
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-full animate-pulse" />
                <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-2 border-yellow-500/30">
                  <AlertCircle className="w-10 h-10 text-yellow-400" />
                </div>
              </div>
            </motion.div>

            <DialogTitle className="text-2xl font-bold text-white text-center tracking-tight">
              Insufficient Credits
            </DialogTitle>
            <DialogDescription asChild>
              <div className="text-gray-300 text-center text-base leading-relaxed">
                You need <span className="font-semibold text-yellow-400">{requiredCredits} credits</span> to {action}, but you only have <span className="font-semibold text-white">{currentBalance} credits</span>.
              </div>
            </DialogDescription>
          </DialogHeader>

          {/* Credits comparison cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* Required Credits Card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative bg-gradient-to-br from-gray-800/80 to-gray-800/60 rounded-xl p-4 border border-gray-700/50 backdrop-blur-sm hover:border-yellow-500/30 transition-all duration-300"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Required</div>
                <div className="flex items-center gap-1.5">
                  <Diamond className="w-4 h-4 text-yellow-400" />
                  <span className="text-2xl font-bold text-yellow-400">{requiredCredits}</span>
                </div>
              </div>
            </motion.div>

            {/* Current Balance Card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="relative bg-gradient-to-br from-gray-800/80 to-gray-800/60 rounded-xl p-4 border border-gray-700/50 backdrop-blur-sm hover:border-blue-500/30 transition-all duration-300"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Current</div>
                <div className="flex items-center gap-1.5">
                  <Diamond className="w-4 h-4 text-blue-400" />
                  <span className="text-2xl font-bold text-white">{currentBalance}</span>
                </div>
              </div>
            </motion.div>

            {/* Shortfall Card */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="relative bg-gradient-to-br from-red-500/10 to-red-600/5 rounded-xl p-4 border border-red-500/30 backdrop-blur-sm hover:border-red-500/50 transition-all duration-300"
            >
              <div className="flex flex-col items-center space-y-2">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">Shortfall</div>
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-2xl font-bold text-red-400">{shortfall}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Info message */}
          <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-gray-300 leading-relaxed">
              Purchase credits or subscribe to a plan to continue creating amazing content.
            </p>
          </div>
        </div>

        {/* Footer with buttons */}
        <DialogFooter className="px-6 pb-6 pt-0 gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white hover:border-gray-600 transition-all"
          >
            Cancel
          </Button>
          <Button
            onClick={handleGoToPricing}
            className="flex-1 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-semibold shadow-lg shadow-yellow-500/25 hover:shadow-yellow-500/40 transition-all group"
          >
            <span>Go to Pricing</span>
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

