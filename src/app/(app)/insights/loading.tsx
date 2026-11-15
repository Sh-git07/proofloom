import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function InsightsLoading() {
  return (
    <RouteSkeleton
      sectionNumber="08"
      sectionTitle="GOVERNANCE INSIGHTS"
      cardCount={4}
      hasTable={true}
    />
  );
}
