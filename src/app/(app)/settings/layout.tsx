import { SettingsTabs } from "./tabs";

// Settings pages load their data in the browser after sign-in, like the rest of the app.
export const instant = false;

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return <SettingsTabs>{children}</SettingsTabs>;
}
