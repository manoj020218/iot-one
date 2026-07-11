import { Outlet } from "react-router-dom";

import { AppBottomNav } from "./AppBottomNav";

export function AuthenticatedAppFrame() {
  return (
    <div className="app-frame">
      <div className="app-frame-body">
        <Outlet />
      </div>
      <AppBottomNav />
    </div>
  );
}
