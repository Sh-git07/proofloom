import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function StudioLoading() {
  return (
    <div className="max-w-5xl mx-auto">
      <RouteSkeleton
        sectionNumber="02"
        sectionTitle="CONTENT STUDIO"
        cardCount={0}
        hasTable={false}
      />
    </div>
  );
}
