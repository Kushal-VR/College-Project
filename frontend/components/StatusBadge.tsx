"use client";

import React from "react";

export type StatusType =
  | "healthy"
  | "connected"
  | "operational"
  | "ready"
  | "degraded"
  | "unhealthy"
  | "disconnected"
  | "offline"
  | "loading"
  | string;

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  subtext?: string;
}

export function StatusBadge({ status, label, subtext }: StatusBadgeProps) {
  const isGood = status === "healthy" || status === "connected" || status === "operational" || status === "ready";
  const isWarn = status === "degraded";
  const isLoading = status === "loading";

  const colorClass = isGood
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isWarn
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : isLoading
    ? "bg-blue-50 text-blue-700 border-blue-200"
    : "bg-rose-50 text-rose-700 border-rose-200";

  const dotColor = isGood
    ? "bg-emerald-500"
    : isWarn
    ? "bg-amber-500"
    : isLoading
    ? "bg-blue-500"
    : "bg-rose-500";

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isLoading ? "animate-ping" : ""}`} />
      <span className="capitalize">{label || status}</span>
      {subtext && <span className="text-[10px] opacity-75 font-mono">({subtext})</span>}
    </div>
  );
}
