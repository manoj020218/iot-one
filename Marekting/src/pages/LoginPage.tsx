import { PageMeta } from "../components/PageMeta";
import { RedirectCard } from "../components/RedirectCard";

export function LoginPage() {
  return (
    <>
      <PageMeta
        title="Login | Smart One by Jenix"
        description="Continue to the Smart One application for account access and connected product operations."
      />
      <RedirectCard
        title="Opening the Smart One application"
        body="This public website introduces the platform. Application sign-in and device operations continue in the Smart One app environment."
      />
    </>
  );
}
