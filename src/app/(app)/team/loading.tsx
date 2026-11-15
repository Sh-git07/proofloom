import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function TeamLoading() {
  return (
    <RouteSkeleton
      sectionNumber="09"
      sectionTitle="TEAM & ACCESS"
      cardCount={3}
      hasTable={true}
    />
  );
}
