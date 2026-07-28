import { BrowserRouter } from "react-router-dom";

import { AppRouter } from "./app/AppRouter";
import { AuthSessionProvider } from "./app/AuthSessionProvider";
import "./styles.css";

export function App() {
  return (
    <BrowserRouter
      basename="/app"
      future={{
        v7_relativeSplatPath: true,
        v7_startTransition: true
      }}
    >
      <AuthSessionProvider>
        <AppRouter />
      </AuthSessionProvider>
    </BrowserRouter>
  );
}
