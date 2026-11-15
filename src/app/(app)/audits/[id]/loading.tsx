import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function AuditDetailLoading() {
  return (
    <RouteSkeleton
      sectionNumber="03"
      sectionTitle="AUDIT INSPECTION"
      cardCount={4}
      hasTable={false}
    />
  );
}
