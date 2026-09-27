"use client";

import { useState, type ReactNode } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

type TurnaroundGroup = { label: string; avgDays: number; count: number };
type RegistrationBucket = { label: string; count: number };

/**
 * Item 6: a couple of charts on Reports. `recharts` was added as a new
 * dependency (package.json had no charting library — checked first, per
 * the project owner's note). Client component since recharts renders via
 * browser measurement (ResponsiveContainer); the reports page (a Server
 * Component) fetches and pre-aggregates the data, this just draws it.
 */
export function TurnaroundCharts({
  byProblemType,
  byTechnician,
  weekly,
  monthly,
}: {
  byProblemType: TurnaroundGroup[];
  byTechnician: TurnaroundGroup[];
  weekly: RegistrationBucket[];
  monthly: RegistrationBucket[];
}) {
  const [registrationView, setRegistrationView] = useState<"weekly" | "monthly">("weekly");
  const registrationData = registrationView === "weekly" ? weekly : monthly;

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="Avg. turnaround by problem type"
        subtitle="Days from received to delivered · Delivered jobs only"
      >
        {byProblemType.length === 0 ? (
          <EmptyChartState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byProblemType} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1d9ee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(value, _name, item) => [`${value} days (${item.payload.count} jobs)`, "Avg. turnaround"]} />
              <Bar dataKey="avgDays" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Avg. turnaround by technician"
        subtitle="Days from received to delivered · Delivered jobs only"
      >
        {byTechnician.length === 0 ? (
          <EmptyChartState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={byTechnician} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1d9ee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={56} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(value, _name, item) => [`${value} days (${item.payload.count} jobs)`, "Avg. turnaround"]} />
              <Bar dataKey="avgDays" fill="#ff6a3d" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard
        title="Jobs registered over time"
        subtitle="Devices received, most recent window"
        className="lg:col-span-2"
        action={
          <div className="flex rounded-full bg-stone-100 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRegistrationView("weekly")}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                registrationView === "weekly" ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setRegistrationView("monthly")}
              className={`rounded-full px-3 py-1.5 transition-colors ${
                registrationView === "monthly" ? "bg-white text-ink shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              Monthly
            </button>
          </div>
        }
      >
        {registrationData.every((b) => b.count === 0) ? (
          <EmptyChartState />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={registrationData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1d9ee" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(value) => [value, "Devices registered"]} />
              <Line type="monotone" dataKey="count" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  action,
  className,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`card p-5 ${className ?? ""}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
          <p className="mt-1 text-xs text-stone-500">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function EmptyChartState() {
  return (
    <div className="flex h-[260px] items-center justify-center text-sm text-stone-400">Not enough data yet.</div>
  );
}
