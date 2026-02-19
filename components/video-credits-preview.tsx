"use client";

import React from "react";
import { calculateVideoCredits, type SubscriptionPlan } from "@/lib/subscription/rules";
import { AlertCircle } from "lucide-react";

interface VideoCreditsPreviewProps {
  plan: SubscriptionPlan;
  selectedResolution: "480p" | "720p" | "1080p";
  selectedDuration: number;
  currentBalance?: number;
  isPaidUser?: boolean;
}

export function VideoCreditsPreview({
  plan,
  selectedResolution,
  selectedDuration,
  currentBalance,
  isPaidUser = false,
}: VideoCreditsPreviewProps) {
  // 计算实际扣除费率
  let actualResolution: "480p" | "720p" | "1080p" = selectedResolution;
  let creditsPerSecond = 0;
  let rateExplanation = "";
  let planName = "";

  if (plan === "basic") {
    actualResolution = "720p";
    creditsPerSecond = 15;
    planName = "Basic订阅";
    if (selectedResolution === "480p") {
      rateExplanation = "Basic订阅将按720p费率扣除，防止低分辨率滥用";
    }
  } else if (plan === "pro") {
    actualResolution = "1080p";
    creditsPerSecond = 24;
    planName = "Pro订阅";
    if (selectedResolution === "480p" || selectedResolution === "720p") {
      rateExplanation = "Pro订阅将按1080p费率扣除，享受最高质量";
    }
  } else if (plan === "studio") {
    actualResolution = "1080p";
    creditsPerSecond = 24;
    planName = "Studio订阅";
    if (selectedResolution === "720p") {
      rateExplanation = "Studio订阅将按1080p费率扣除，享受最高质量";
    }
  } else if (isPaidUser) {
    actualResolution = "720p";
    creditsPerSecond = 15;
    planName = "充值用户";
    rateExplanation = "充值用户统一按720p费率扣除";
  } else {
    actualResolution = "720p";
    creditsPerSecond = 15;
    planName = "Free用户";
    rateExplanation = "Free用户统一按720p费率扣除";
  }

  const totalCredits = calculateVideoCredits(plan || null, selectedResolution, selectedDuration);
  const remainingBalance =
    currentBalance !== undefined ? currentBalance - totalCredits : undefined;
  const isInsufficient = remainingBalance !== undefined && remainingBalance < 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <h3 className="text-sm font-semibold text-gray-300 mb-3">积分扣除预览</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">您选择：</span>
          <span className="text-white font-medium">
            {selectedDuration}秒 {selectedResolution}
          </span>
        </div>

        {selectedResolution !== actualResolution && (
          <div className="flex items-start gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
            <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
            <span className="text-yellow-400 text-xs leading-relaxed">
              {rateExplanation}
            </span>
          </div>
        )}

        <div className="flex justify-between items-center pt-1">
          <span className="text-gray-400">扣除费率：</span>
          <span className="text-white">
            {creditsPerSecond}积分/秒
            <span className="text-gray-500 ml-1">({actualResolution})</span>
          </span>
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-gray-700">
          <span className="text-gray-400">总积分：</span>
          <span className="text-white font-semibold text-lg">{totalCredits}积分</span>
        </div>

        {currentBalance !== undefined && (
          <>
            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-400">当前余额：</span>
              <span className="text-white">{currentBalance}积分</span>
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-gray-400">生成后余额：</span>
              <span
                className={
                  isInsufficient
                    ? "text-red-400 font-semibold"
                    : "text-white font-semibold"
                }
              >
                {remainingBalance !== undefined ? remainingBalance : "--"}积分
              </span>
            </div>
            {isInsufficient && (
              <div className="text-red-400 text-xs mt-1 p-2 bg-red-500/10 border border-red-500/20 rounded">
                积分不足，请先充值
              </div>
            )}
          </>
        )}

        {selectedResolution !== actualResolution && (
          <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-700">
            <p>
              {planName}用户选择{selectedResolution}时，将按{actualResolution}费率扣除，确保服务质量和防止滥用。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

