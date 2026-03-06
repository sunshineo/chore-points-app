import KioskView from "./KioskView";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ kidId: string }>;
}) {
  const { kidId } = await params;
  return <KioskView kidId={kidId} />;
}
