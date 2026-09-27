"use client";

import { useEffect, useRef } from "react";

/**
 * Renders nothing — on mount, tells the server "this device was viewed"
 * so it can be surfaced in the dashboard's Recently Viewed section (item
 * 8). Best-effort: a failed request here must never disrupt the device
 * page itself, so errors are swallowed. `firedRef` guards against a
 * second fire from React 18 Strict Mode's dev-only double-invoke of
 * effects — harmless either way (the route just moves the same id to the
 * front again), but avoids a redundant request.
 */
export function RecordDeviceView({ deviceId }: { deviceId: number }) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    fetch(`/api/devices/${deviceId}/view`, { method: "POST" }).catch(() => {});
  }, [deviceId]);

  return null;
}
