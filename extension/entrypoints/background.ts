export default defineBackground(() => {
  const openSidePanel = () => {
    if (chrome.sidePanel?.setPanelBehavior) {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
        // Some Chromium builds do not implement this API.
      });
    }
  };

  chrome.runtime.onInstalled.addListener(openSidePanel);
  openSidePanel();
});
