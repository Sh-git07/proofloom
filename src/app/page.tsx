import Link from "next/link";
import {
  Shield,
  GitBranch,
  TrendingDown,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F4F1E8] text-[#17251C] flex flex-col">
      {/* Top Navigation */}
      <header className="border-b-2 border-[#253C2B] bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 bg-[#16834A] text-white flex items-center justify-center font-bold font-mono text-sm brutal-border group-hover:bg-[#126b3c] transition-colors">
              PL
            </div>
            <div>
              <span className="font-mono font-extrabold text-lg tracking-tight block leading-none group-hover:text-[#16834A] transition-colors">
                PROOFLOOM
              </span>
              <span className="font-mono text-[9px] text-[#637367] uppercase tracking-wider block mt-0.5">
                Brand Integrity Platform
              </span>
            </div>
          </Link>

          <div className="flex items-center space-x-4">
            <Link
              href="/demo"
              className="px-3 py-1.5 font-mono text-xs font-bold text-[#17251C] hover:text-[#16834A] transition-colors"
            >
              DEMO PORTAL
            </Link>
            <Link
              href="/login"
              className="brutal-btn brutal-btn-secondary px-3 py-1.5 text-xs font-mono font-bold"
            >
              SIGN IN
            </Link>
            <Link
              href="/demo"
              className="brutal-btn brutal-btn-primary px-4 py-1.5 text-xs font-mono font-bold"
            >
              START TRIAL &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 border-b-2 border-[#253C2B] bg-[#F4F1E8]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#B7F28B] brutal-border text-xs font-mono font-bold uppercase mb-6">
            <span className="status-led status-led-live" />
            <span>THE INTELLIGENT TRUST LAYER FOR ENTERPRISE BRAND GOVERNANCE</span>
          </div>

          <h1 className="font-mono font-extrabold text-4xl sm:text-6xl tracking-tight text-[#17251C] leading-[1.1] mb-6">
            Your brand deserves <br className="hidden sm:inline" />
            <span className="bg-[#16834A] text-white px-2">more than a spellcheck.</span>
          </h1>

          <p className="text-lg sm:text-xl text-[#637367] max-w-2xl mx-auto mb-8 font-medium">
            Meet the intelligent trust layer between content creation and publication.
            Verify claims, protect your brand voice, and approve every message with confidence.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/demo"
              className="w-full sm:w-auto brutal-btn brutal-btn-lime px-8 py-3.5 text-sm font-bold tracking-wider"
            >
              START PROTECTING YOUR BRAND &rarr;
            </Link>
            <Link
              href="/demo"
              className="w-full sm:w-auto brutal-btn brutal-btn-secondary px-8 py-3.5 text-sm font-bold tracking-wider"
            >
              EXPLORE THE DEMO (4 ROLES)
            </Link>
          </div>

          <p className="font-mono text-xs text-[#637367] mt-4 uppercase tracking-wider">
            Tagline: Where every brand claim has a thread of proof.
          </p>
        </div>
      </section>

      {/* Proof Banner */}
      <div className="bg-[#17251C] text-[#F4F1E8] border-b-2 border-[#253C2B] py-3 px-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center justify-around text-xs font-mono uppercase tracking-wider space-x-6 min-w-max">
          <span>&bull; EVIDENCE BEFORE CONFIDENCE</span>
          <span>&bull; EXPLAIN EVERY FINDING</span>
          <span>&bull; PRESERVE CREATOR INTENT</span>
          <span>&bull; HUMAN DECISION CONTROL</span>
          <span>&bull; IMMUTABLE AUDIT TRAIL</span>
        </div>
      </div>

      {/* Feature Showcase Grid */}
      <section className="py-16 px-6 max-w-7xl mx-auto w-full">
        <div className="mb-12">
          <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider block">
            01 &mdash; ARCHITECTURE
          </span>
          <h2 className="font-mono font-extrabold text-3xl text-[#17251C] tracking-tight mt-1">
            Core Governance Engines
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1 */}
          <div className="brutal-card p-6">
            <div className="w-10 h-10 bg-[#B7F28B] brutal-border flex items-center justify-center mb-4">
              <GitBranch className="w-5 h-5 text-[#17251C]" />
            </div>
            <h3 className="font-mono font-bold text-lg text-[#17251C] mb-2">
              Claim Provenance Engine
            </h3>
            <p className="text-sm text-[#637367] leading-relaxed">
              Every numerical claim is extracted, matched against approved empirical facts, and
              traced via strict mathematical tolerance. Contradictions and outdated figures are stopped cold.
            </p>
          </div>

          {/* Card 2 */}
          <div className="brutal-card p-6">
            <div className="w-10 h-10 bg-[#16834A] text-white brutal-border flex items-center justify-center mb-4">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-mono font-bold text-lg text-[#17251C] mb-2">
              Brand Drift Radar
            </h3>
            <p className="text-sm text-[#637367] leading-relaxed">
              Systemic analysis across departmental submissions flags recurring terminology infractions,
              prohibited buzzword clusters, and lingering outdated statistics before they contaminate campaigns.
            </p>
          </div>

          {/* Card 3 */}
          <div className="brutal-card p-6">
            <div className="w-10 h-10 bg-[#DDEBDD] brutal-border flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-[#16834A]" />
            </div>
            <h3 className="font-mono font-bold text-lg text-[#17251C] mb-2">
              Brand Memory Court
            </h3>
            <p className="text-sm text-[#637367] leading-relaxed">
              Empower creators to challenge findings respectfully. Authorized reviewers uphold, reverse,
              or document targeted campaign exceptions with immutable audit trails.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t-2 border-[#253C2B] bg-white py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-[#637367]">
          <span>PROOFLOOM &copy; 2026 &bull; Brand Governance & Integrity</span>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <Link href="/demo" className="text-[#16834A] font-bold hover:underline">
              Enter Demo
            </Link>
            <Link href="/login" className="hover:underline">
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
