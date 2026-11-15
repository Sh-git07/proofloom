import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function AppLoading() {
  return (
    <RouteSkeleton
      sectionNumber="00"
      sectionTitle="LOADING MODULE"
      cardCount={4}
      hasTable={true}
    />
  );
}
