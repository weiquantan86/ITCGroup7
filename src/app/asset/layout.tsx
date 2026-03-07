import type { ReactNode } from "react";
import HoverHeader from "../components/HoverHeader";

export default function AssetLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <HoverHeader />
      {children}
    </>
  );
}
