/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADSENSE_SLOT_VEHICLE_TOP?: string;
  readonly VITE_ADSENSE_SLOT_VEHICLE_MID?: string;
  readonly VITE_ADSENSE_SLOT_VEHICLE_BOTTOM?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
