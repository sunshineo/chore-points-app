import KioskView from "../mia/KioskView";

const LOCAL_KIOSK_ID = "local-kiosk-mia";
const REMOTE_KIOSK_ID = process.env.NEXT_PUBLIC_KIOSK_KID_ID;
const REMOTE_KIOSK_TOKEN = process.env.NEXT_PUBLIC_KIOSK_TOKEN;

export default function LocalKioskPage() {
  return (
    <KioskView
      kidId={LOCAL_KIOSK_ID}
      remoteKidId={REMOTE_KIOSK_ID}
      remoteToken={REMOTE_KIOSK_TOKEN}
    />
  );
}
