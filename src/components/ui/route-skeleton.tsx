export function RouteSkeleton({
  sectionNumber,
  sectionTitle,
  cardCount = 3,
  hasTable = false,
}: {
  sectionNumber: string;
  sectionTitle: string;
  cardCount?: number;
  hasTable?: boolean;
}) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Console Skeleton */}
      <div className="brutal-panel bg-white p-5">
        <div className="flex items-center space-x-2">
          <span className="font-mono text-xs font-bold text-[#16834A] tracking-wider uppercase">
            {sectionNumber} &mdash; {sectionTitle}
          </span>
          <span className="inline-block w-2 h-2 bg-[#B7F28B] brutal-border" />
        </div>
        <div className="h-7 w-72 bg-[#17251C]/15 brutal-border mt-2" />
        <div className="h-4 w-96 max-w-full bg-[#637367]/20 mt-1" />
      </div>

      {/* Metric Cards Skeleton */}
      {cardCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: cardCount }).map((_, i) => (
            <div key={i} className="brutal-panel bg-white p-4 space-y-2">
              <div className="h-3 w-20 bg-[#637367]/20" />
              <div className="h-8 w-16 bg-[#17251C]/20" />
              <div className="h-2 w-28 bg-[#16834A]/20" />
            </div>
          ))}
        </div>
      )}

      {/* Main Content / Table Skeleton */}
      {hasTable ? (
        <div className="brutal-card bg-white p-5 space-y-3">
          <div className="h-5 w-48 bg-[#17251C]/20" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-[#F4F1E8] brutal-border flex items-center px-4 justify-between"
              >
                <div className="h-4 w-1/3 bg-[#17251C]/15" />
                <div className="h-4 w-20 bg-[#16834A]/20" />
                <div className="h-4 w-16 bg-[#637367]/20" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="brutal-card bg-white p-6 space-y-4">
          <div className="h-6 w-1/3 bg-[#17251C]/20" />
          <div className="h-32 bg-[#F4F1E8] brutal-border" />
          <div className="h-10 w-32 bg-[#16834A]/40 brutal-border" />
        </div>
      )}
    </div>
  );
}
