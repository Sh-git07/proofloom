import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function AuditsLoading() {
  return (
    <RouteSkeleton
      sectionNumber="03"
      sectionTitle="AUDIT HISTORY"
      cardCount={3}
      hasTable={true}
    />
  );
}
