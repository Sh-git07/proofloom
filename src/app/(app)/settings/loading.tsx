import { RouteSkeleton } from "@/components/ui/route-skeleton";

export default function SettingsLoading() {
  return (
    <div className="max-w-5xl">
      <RouteSkeleton
        sectionNumber="10"
        sectionTitle="GOVERNANCE SETTINGS"
        cardCount={3}
        hasTable={false}
      />
    </div>
  );
}
