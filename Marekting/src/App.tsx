import { Navigate, Route, Routes } from "react-router-dom";

import { SiteLayout } from "./components/SiteLayout";
import { AboutPage } from "./pages/AboutPage";
import { AcceptableUsePage } from "./pages/AcceptableUsePage";
import { ContactPage } from "./pages/ContactPage";
import { CookiesPage } from "./pages/CookiesPage";
import { DataDeletionPage } from "./pages/DataDeletionPage";
import { DevelopersPage } from "./pages/DevelopersPage";
import { HomePage } from "./pages/HomePage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { LoginPage } from "./pages/LoginPage";
import { OemPage } from "./pages/OemPage";
import { PlatformPage } from "./pages/PlatformPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { RefundPolicyPage } from "./pages/RefundPolicyPage";
import { SecurityPage } from "./pages/SecurityPage";
import { SignupPage } from "./pages/SignupPage";
import { SupportPage } from "./pages/SupportPage";
import { TermsPage } from "./pages/TermsPage";

export function App() {
  return (
    <SiteLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/platform" element={<PlatformPage />} />
        <Route path="/oem" element={<OemPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/developers" element={<DevelopersPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/cookies" element={<CookiesPage />} />
        <Route path="/acceptable-use" element={<AcceptableUsePage />} />
        <Route path="/data-deletion" element={<DataDeletionPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </SiteLayout>
  );
}
