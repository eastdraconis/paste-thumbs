"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const CheckinApp = dynamic(() => import("./checkin-client"), {
  ssr: false,
});

export default function CheckinLoader(props: ComponentProps<typeof CheckinApp>) {
  return <CheckinApp {...props} />;
}
