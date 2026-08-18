import KioskView from "../mia/KioskView";

const LOCAL_KIOSK_ID = "local-kiosk-mia";

export default function LocalKioskPage() {
  return <KioskView kidId={LOCAL_KIOSK_ID} />;
}
