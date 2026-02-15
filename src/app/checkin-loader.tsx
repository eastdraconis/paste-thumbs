"use client";

import dynamic from "next/dynamic";

const CheckinApp = dynamic(() => import("./checkin-client"), {
  ssr: false,
});

export default function CheckinLoader() {
  return <CheckinApp />;
}
