"use client";

import * as React from "react";
import Link from "next/link";
import { Search, ArrowUpRight, AlertTriangle, FileText } from "lucide-react";
import { IdTag } from "@/components/ui/id-tag";

export interface AuditRecord {
  id: string;
  overall_score: number | null;
  status: string;
  mode: string;
  created_at: string;
  content_item?: {
    id: string;
    title: string;
    content_type: string;
    platform: string;
    department: string;
  } | null;
  critical_count: number;
}

export function AuditHistoryView({ audits }: { audits: AuditRecord[] }) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [deptFilter, setDeptFilter] = React.useState("ALL");
  const [typeFilter, setTypeFilter] = React.useState("ALL");

  // Derive unique departments and content types for filter dropdowns
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    audits.forEach((a) => {
      if (a.content_item?.department) set.add(a.content_item.department);
    });
    return Array.from(set).sort();
  }, [audits]);

  const contentTypes = React.useMemo(() => {
    const set = new Set<string>();
    audits.forEach((a) => {
      if (a.content_item?.content_type) set.add(a.content_item.content_type);
    });
    return Array.from(set).sort();
  }, [audits]);

  // Filtered records
  const filteredAudits = React.useMemo(() => {
    return audits.filter((audit) => {
      const title = audit.content_item?.title || "";
      const dept = audit.content_item?.department || "";
      const type = audit.content_item?.content_type || "";
      const id = audit.id;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          title.toLowerCase().includes(q) ||
          dept.toLowerCase().includes(q) ||
          id.toLowerCase().includes(q);
        if (!matches) return false;
      }

      if (statusFilter !== "ALL" && audit.status !== statusFilter) {
        return false;
      }

      if (deptFilter !== "ALL" && dept !== deptFilter) {
        return false;
      }

      if (typeFilter !== "ALL" && type !== typeFilter) {
        return false;
      }

      return true;
    });
  }, [audits, searchQuery, statusFilter, deptFilter, typeFilter]);

  // Aggregate metrics
  const totalCount = audits.length;
  const passedCount = audits.filter((a) => (a.overall_score || 0) >= 80).length;
  const passRate = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
  const avgScore =
    totalCount > 0
      ? Math.round(
          audits.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / totalCount
        )
      : 0;
  const criticalTotal = audits.reduce((acc, curr) => acc + curr.critical_count, 0);

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            TOTAL AUDITS
          </span>
          <span className="font-mono text-2xl font-extrabold text-[#17251C]">
            {totalCount}
          </span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            PASS RATE (&ge; 80)
          </span>
          <span className="font-mono text-2xl font-extrabold text-[#16834A]">
            {passRate}%
          </span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            AVG COMPLIANCE
          </span>
          <span className="font-mono text-2xl font-extrabold text-[#17251C]">
            {avgScore}/100
          </span>
        </div>
        <div className="brutal-card p-4 bg-white">
          <span className="font-mono text-[10px] font-bold text-[#637367] uppercase block">
            CRITICAL FLAWS FOUND
          </span>
          <span className="font-mono text-2xl font-extrabold text-[#D94C4C]">
            {criticalTotal}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="brutal-card p-4 bg-white space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#637367]" />
            <input
              type="text"
              placeholder="Search by title, department, or audit ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F4F1E8] brutal-border text-xs font-mono text-[#17251C] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center space-x-1">
              <span className="font-mono text-[10px] text-[#637367] uppercase font-bold">
                STATUS:
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#F4F1E8] brutal-border px-2 py-1.5 text-xs font-mono text-[#17251C] focus:outline-none"
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="QUEUED">QUEUED</option>
                <option value="REQUIRES_REVIEW">REQUIRES REVIEW</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            {/* Department Filter */}
            {departments.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className="font-mono text-[10px] text-[#637367] uppercase font-bold">
                  DEPT:
                </span>
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  className="bg-[#F4F1E8] brutal-border px-2 py-1.5 text-xs font-mono text-[#17251C] focus:outline-none"
                >
                  <option value="ALL">ALL DEPARTMENTS</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Content Type Filter */}
            {contentTypes.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className="font-mono text-[10px] text-[#637367] uppercase font-bold">
                  TYPE:
                </span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-[#F4F1E8] brutal-border px-2 py-1.5 text-xs font-mono text-[#17251C] focus:outline-none"
                >
                  <option value="ALL">ALL TYPES</option>
                  {contentTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(searchQuery || statusFilter !== "ALL" || deptFilter !== "ALL" || typeFilter !== "ALL") && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("ALL");
                  setDeptFilter("ALL");
                  setTypeFilter("ALL");
                }}
                className="px-2.5 py-1.5 bg-[#DDEBDD] hover:bg-[#B7F28B] text-[#17251C] font-mono text-xs font-bold brutal-border transition-colors"
              >
                CLEAR
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Records Table */}
      <div className="brutal-card bg-white p-5 overflow-x-auto">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#253C2B] mb-3">
          <span className="font-mono text-xs font-bold text-[#17251C] uppercase">
            AUDIT RECORDS ({filteredAudits.length})
          </span>
          <span className="font-mono text-[10px] text-[#637367]">
            Showing real-time records from Supabase
          </span>
        </div>

        {filteredAudits.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <FileText className="w-10 h-10 text-[#637367] mx-auto opacity-50" />
            <p className="font-mono text-xs text-[#637367]">
              No audit logs matched your query.
            </p>
            <Link
              href="/studio"
              className="inline-block px-3 py-1.5 bg-[#16834A] text-white font-mono text-xs font-bold brutal-border brutal-shadow-sm"
            >
              RUN NEW AUDIT
            </Link>
          </div>
        ) : (
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b-2 border-[#253C2B] bg-[#F4F1E8] text-[#637367]">
                <th className="py-2.5 px-3">AUDIT ID</th>
                <th className="py-2.5 px-3">CONTENT TITLE</th>
                <th className="py-2.5 px-3">DEPT</th>
                <th className="py-2.5 px-3">TYPE / CHANNEL</th>
                <th className="py-2.5 px-3">SCORE</th>
                <th className="py-2.5 px-3">STATUS</th>
                <th className="py-2.5 px-3">DATE</th>
                <th className="py-2.5 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y border-b-2 border-[#253C2B]">
              {filteredAudits.map((audit) => {
                const item = audit.content_item;
                const score = audit.overall_score || 0;

                return (
                  <tr key={audit.id} className="hover:bg-[#F4F1E8] transition-colors">
                    <td className="py-3 px-3">
                      <IdTag id={audit.id.slice(0, 8)} />
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-bold text-[#17251C] block line-clamp-1">
                        {item?.title || "Untitled Draft"}
                      </span>
                      {audit.critical_count > 0 && (
                        <span className="text-[10px] font-bold text-[#D94C4C] inline-flex items-center space-x-1 mt-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{audit.critical_count} CRITICAL</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#637367]">
                      {item?.department || "General"}
                    </td>
                    <td className="py-3 px-3 text-[#637367]">
                      <span className="block text-[#17251C]">{item?.content_type || "Text"}</span>
                      <span className="text-[10px]">{item?.platform || "Web"}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 text-xs brutal-border ${
                          score >= 80
                            ? "bg-[#B7F28B] text-[#17251C]"
                            : score >= 60
                            ? "bg-[#E6A23C] text-white"
                            : "bg-[#D94C4C] text-white"
                        }`}
                      >
                        {score}/100
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 text-[10px] font-bold brutal-border bg-white text-[#17251C]">
                        {audit.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#637367] text-[11px]">
                      {new Date(audit.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/audits/${audit.id}`}
                        className="inline-flex items-center space-x-1 text-xs font-bold text-[#16834A] hover:underline"
                      >
                        <span>VIEW REPORT</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
