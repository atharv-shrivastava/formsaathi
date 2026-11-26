import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "FormSaathi",
    description: "Document-aware, human-reviewed government form guidance.",
    version: "0.1.0",
    permissions: ["storage", "activeTab", "sidePanel"],
    host_permissions: [
      "https://jsurlqzbpmianyvmteto.supabase.co/*",
      "https://formsaathi-web.vercel.app/*",
      "https://formsaathi-ocr-api.onrender.com/*"
    ],
    side_panel: {
      default_path: "sidepanel.html"
    },
    action: {
      default_title: "Open FormSaathi"
    }
  }
});
