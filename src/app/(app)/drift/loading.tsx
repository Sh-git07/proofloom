import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function DriftLoading() {
  return (
    <RouteSkeleton
      sectionNumber="07"
      sectionTitle="BRAND DRIFT RADAR"
      cardCount={3}
      hasTable={true}
    />
  );
}
