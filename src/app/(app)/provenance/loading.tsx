import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function ProvenanceLoading() {
  return (
    <RouteSkeleton
      sectionNumber="05"
      sectionTitle="CLAIM PROVENANCE PIPELINE"
      cardCount={3}
      hasTable={false}
    />
  );
}
