import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Saral Form",
    description: "Review documents, match approved profile information and fill forms with your approval.",
    version: "0.1.0",
    icons: { 48: "icons/saral-form-icon.png" },
    permissions: ["storage", "activeTab", "sidePanel", "webNavigation"],
    host_permissions: [
      "https://jsurlqzbpmianyvmteto.supabase.co/*",
      "https://formsaathi-web.vercel.app/*",
      "https://formsaathi-ocr-api.onrender.com/*"
    ],
    side_panel: {
      default_path: "sidepanel.html"
    },
    action: {
      default_title: "Open Saral Form",
      default_icon: "icons/saral-form-icon.png"
    }
  }
});
