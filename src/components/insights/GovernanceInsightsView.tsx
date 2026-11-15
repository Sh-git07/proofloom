"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import {
  TrendingUp,
  Download,
  ShieldCheck,
  AlertTriangle,
  Building,
} from "lucide-react";

export interface DepartmentMetric {
  department: string;
  auditCount: number;
  averageScore: number;
  criticalIssues: number;
}

export interface DimensionMetric {
  dimension: string;
  count: number;
  color: string;
}

export interface TrendMetric {
  period: string;
  volume: number;
  score: number;
}

export interface ViolationMetric {
  item: string;
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  occurrences: number;
  action: string;
}

const emptySubscribe = () => () => {};

export function GovernanceInsightsView({
  organisationName,
  totalAudits,
  averageScore,
  approvalRate,
  deptMetrics,
  dimensionMetrics,
  trendMetrics,
  topViolations,
}: {
  organisationName: string;
  totalAudits: number;
  averageScore: number;
  approvalRate: number;
  deptMetrics: DepartmentMetric[];
  dimensionMetrics: DimensionMetric[];
  trendMetrics: TrendMetric[];
  topViolations: ViolationMetric[];
}) {
  const isMounted = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const handleExportMarkdown = () => {
    const reportDate = new Date().toISOString().split("T")[0];
    const mdContent = `# PROOFLOOM Brand Integrity & Governance Report
**Organisation:** ${organisationName}
**Generated:** ${reportDate}
**Tagline:** Where every brand claim has a thread of proof.

---

## 1. Executive Telemetry Summary
- **Overall Brand Integrity Index:** ${averageScore}/100
- **Total Audits Executed:** ${totalAudits}
- **Governance Approval Rate:** ${approvalRate}%
- **Average Sign-Off Turnaround:** 4.2 hours

---

## 2. Department Compliance Breakdown
| Department | Total Audits | Average Compliance Score | Critical Issues |
|---|---|---|---|
${deptMetrics
  .map(
    (d) =>
      `| ${d.department} | ${d.auditCount} | ${d.averageScore}/100 | ${d.criticalIssues} |`
  )
  .join("\n")}

---

## 3. Findings Distribution by Governance Dimension
| Dimension | Total Violations Recorded |
|---|---|
${dimensionMetrics.map((dm) => `| ${dm.dimension} | ${dm.count} |`).join("\n")}

---

## 4. Top Recurring Non-Compliant Benchmarks & Violations
| Flagged Phrase / Statistic | Category | Severity | Frequency | Recommended Remediation |
|---|---|---|---|---|
${topViolations
  .map(
    (v) =>
      `| "${v.item}" | ${v.category} | ${v.severity} | ${v.occurrences}x | ${v.action} |`
  )
  .join("\n")}

---
*Generated automatically by PROOFLOOM Governance Engine.*
`;

    const blob = new Blob([mdContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `PROOFLOOM_Governance_Report_${reportDate}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const reportDate = new Date().toISOString().split("T")[0];
    const data = {
      organisation: organisationName,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAudits,
        averageScore,
        approvalRate,
      },
      departmentCompliance: deptMetrics,
      dimensionBreakdown: dimensionMetrics,
      historicalTrends: trendMetrics,
      topViolations,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `PROOFLOOM_Governance_Metrics_${reportDate}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header with Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-[#253C2B] pb-4">
        <div>
          <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
            08 &mdash; GOVERNANCE INSIGHTS
          </span>
          <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
            EXECUTIVE INTEGRITY & DRIFT ANALYTICS
          </h1>
          <p className="text-xs sm:text-sm text-[#637367]">
            Empirical compliance trends, cross-department comparisons, and systemic risk telemetry.
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={handleExportMarkdown}
            className="brutal-btn bg-[#F4F1E8] hover:bg-[#DDEBDD] text-[#17251C] px-3 py-2 text-xs font-mono font-bold flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT .MD</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="brutal-btn brutal-btn-primary px-3 py-2 text-xs font-mono font-bold flex items-center space-x-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT .JSON</span>
          </button>
        </div>
      </div>

      {/* 2. Top Telemetry Stat Panels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            BRAND INTEGRITY INDEX
          </span>
          <span
            className={`font-mono text-3xl font-extrabold mt-1 block ${
              averageScore >= 80
                ? "text-[#16834A]"
                : averageScore >= 60
                ? "text-[#E6A23C]"
                : "text-[#D94C4C]"
            }`}
          >
            {averageScore}/100
          </span>
          <span className="text-[10px] font-mono text-[#637367]">Across all departments</span>
        </div>

        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            AUDITS EXECUTED
          </span>
          <span className="font-mono text-3xl font-extrabold text-[#17251C] mt-1 block">
            {totalAudits}
          </span>
          <span className="text-[10px] font-mono text-[#16834A] font-bold">100% Deterministic</span>
        </div>

        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            APPROVAL RATE
          </span>
          <span className="font-mono text-3xl font-extrabold text-[#16834A] mt-1 block">
            {approvalRate}%
          </span>
          <span className="text-[10px] font-mono text-[#637367]">Submissions approved</span>
        </div>

        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            SIGN-OFF VELOCITY
          </span>
          <span className="font-mono text-3xl font-extrabold text-[#17251C] mt-1 block">
            4.2h
          </span>
          <span className="text-[10px] font-mono text-[#637367]">Avg review turnaround</span>
        </div>
      </div>

      {/* 3. Recharts Section: Trend Chart & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend Chart (7 cols) */}
        <div className="lg:col-span-7 brutal-card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
            <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-[#16834A]" />
              <span>AUDIT VOLUME & COMPLIANCE TRENDS</span>
            </span>
            <span className="font-mono text-[10px] text-[#637367]">Last 6 Months</span>
          </div>

          <div className="h-64 w-full">
            {!isMounted ? (
              <div className="h-full w-full bg-[#F4F1E8] flex items-center justify-center font-mono text-xs text-[#637367]">
                Loading telemetry trend...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendMetrics} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#253C2B" opacity={0.15} />
                  <XAxis dataKey="period" stroke="#17251C" fontSize={11} fontFamily="monospace" />
                  <YAxis stroke="#17251C" fontSize={11} fontFamily="monospace" domain={[50, 100]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F4F1E8",
                      border: "2px solid #253C2B",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      borderRadius: "0px",
                      boxShadow: "4px 4px 0px #253C2B",
                    }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "11px" }} />
                  <Line
                    type="monotone"
                    dataKey="score"
                    name="Avg Integrity (0-100)"
                    stroke="#16834A"
                    strokeWidth={3}
                    dot={{ fill: "#B7F28B", stroke: "#253C2B", strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="volume"
                    name="Audit Volume"
                    stroke="#17251C"
                    strokeWidth={2}
                    dot={{ fill: "#17251C", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Department Compliance (5 cols) */}
        <div className="lg:col-span-5 brutal-card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
            <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
              <Building className="w-4 h-4 text-[#16834A]" />
              <span>DEPARTMENT COMPLIANCE</span>
            </span>
            <span className="font-mono text-[10px] text-[#637367]">Avg Score</span>
          </div>

          <div className="h-64 w-full">
            {!isMounted ? (
              <div className="h-full w-full bg-[#F4F1E8] flex items-center justify-center font-mono text-xs text-[#637367]">
                Loading department metrics...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={deptMetrics}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#253C2B" opacity={0.15} />
                  <XAxis type="number" domain={[0, 100]} stroke="#17251C" fontSize={10} fontFamily="monospace" />
                  <YAxis
                    dataKey="department"
                    type="category"
                    stroke="#17251C"
                    fontSize={10}
                    fontFamily="monospace"
                    width={90}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F4F1E8",
                      border: "2px solid #253C2B",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      borderRadius: "0px",
                      boxShadow: "4px 4px 0px #253C2B",
                    }}
                  />
                  <Bar dataKey="averageScore" name="Avg Score" fill="#16834A">
                    {deptMetrics.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.averageScore >= 80
                            ? "#16834A"
                            : entry.averageScore >= 65
                            ? "#E6A23C"
                            : "#D94C4C"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 4. Violation Dimensions & Top Benchmarks Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Violation by Governance Dimension Pie Chart (4 cols) */}
        <div className="lg:col-span-4 brutal-card bg-white p-5 space-y-4">
          <div className="border-b-2 border-[#253C2B] pb-2">
            <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-[#E6A23C]" />
              <span>VIOLATIONS BY DIMENSION</span>
            </span>
          </div>

          <div className="h-60 w-full">
            {!isMounted ? (
              <div className="h-full w-full bg-[#F4F1E8] flex items-center justify-center font-mono text-xs text-[#637367]">
                Loading dimension chart...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={dimensionMetrics}
                    dataKey="count"
                    nameKey="dimension"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={38}
                    paddingAngle={3}
                  >
                    {dimensionMetrics.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} stroke="#253C2B" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#F4F1E8",
                      border: "2px solid #253C2B",
                      fontFamily: "monospace",
                      fontSize: "12px",
                      boxShadow: "4px 4px 0px #253C2B",
                    }}
                  />
                  <Legend wrapperStyle={{ fontFamily: "monospace", fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Top Recurring Violations Table (8 cols) */}
        <div className="lg:col-span-8 brutal-card bg-white p-5 space-y-4 overflow-x-auto">
          <div className="flex items-center justify-between border-b-2 border-[#253C2B] pb-2">
            <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#16834A]" />
              <span>TOP RECURRING NON-COMPLIANT BENCHMARKS</span>
            </span>
            <span className="font-mono text-[10px] text-[#637367]">Ranked by Frequency</span>
          </div>

          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b-2 border-[#253C2B] bg-[#F4F1E8] text-[#637367]">
                <th className="py-2.5 px-3">FLAGGED SPAN</th>
                <th className="py-2.5 px-3">CATEGORY</th>
                <th className="py-2.5 px-3">SEVERITY</th>
                <th className="py-2.5 px-3">OCCURRENCES</th>
                <th className="py-2.5 px-3">REMEDIATION ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y border-b-2 border-[#253C2B]">
              {topViolations.map((v, i) => (
                <tr key={i} className="hover:bg-[#F4F1E8] transition-colors">
                  <td className="py-3 px-3 font-bold text-[#17251C]">
                    &ldquo;{v.item}&rdquo;
                  </td>
                  <td className="py-3 px-3 text-[#637367]">{v.category}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`px-1.5 py-0.5 text-[9px] font-extrabold brutal-border uppercase ${
                        v.severity === "CRITICAL"
                          ? "bg-[#D94C4C] text-white"
                          : v.severity === "HIGH"
                          ? "bg-[#E6A23C] text-[#17251C]"
                          : "bg-[#B7F28B] text-[#17251C]"
                      }`}
                    >
                      {v.severity}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-[#D94C4C]">{v.occurrences}x</td>
                  <td className="py-3 px-3 text-[11px] text-[#17251C]">{v.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
