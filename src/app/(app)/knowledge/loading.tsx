import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function KnowledgeLoading() {
  return (
    <RouteSkeleton
      sectionNumber="04"
      sectionTitle="BRAND KNOWLEDGE VAULT"
      cardCount={3}
      hasTable={true}
    />
  );
}
