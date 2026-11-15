import Link from "next/link";

export default function StudioPage() {

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b-2 border-[#253C2B] pb-4">
        <span className="font-mono text-xs font-bold text-[#16834A] uppercase tracking-wider">
          02 &mdash; CONTENT STUDIO
        </span>
        <h1 className="font-mono font-extrabold text-2xl sm:text-3xl tracking-tight text-[#17251C] mt-1">
          SUBMISSION & VERIFICATION STUDIO
        </h1>
        <p className="text-xs sm:text-sm text-[#637367]">
          Draft content or upload documents for multi-stage brand integrity analysis.
        </p>
      </div>

      <div className="brutal-card p-6 bg-white space-y-4">
        <h3 className="font-mono font-bold text-base text-[#17251C]">
          Content Submission Form
        </h3>
        <p className="text-xs text-[#637367]">
          Content Studio core engine is wired in Phase 2. To review seeded verification runs, navigate to Audit History.
        </p>
        <Link
          href="/audits"
          className="brutal-btn brutal-btn-primary px-4 py-2 text-xs font-bold inline-flex items-center space-x-2"
        >
          <span>VIEW AUDIT HISTORY &rarr;</span>
        </Link>
      </div>
    </div>
  );
}
