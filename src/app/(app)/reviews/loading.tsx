import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function ReviewsLoading() {
  return (
    <RouteSkeleton
      sectionNumber="06"
      sectionTitle="REVIEW QUEUE & GOVERNANCE"
      cardCount={3}
      hasTable={true}
    />
  );
}
