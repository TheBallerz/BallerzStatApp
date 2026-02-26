import type { ReactNode } from "react";
import TopNav from "./TopNav";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <>
      <TopNav />
      <div className="layout-content">{children}</div>
    </>
  );
}
