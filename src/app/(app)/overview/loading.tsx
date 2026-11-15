import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function OverviewLoading() {
  return (
    <RouteSkeleton
      sectionNumber="01"
      sectionTitle="SYSTEM OVERVIEW"
      cardCount={4}
      hasTable={true}
    />
  );
}
