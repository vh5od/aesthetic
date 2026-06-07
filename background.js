const MESSAGE_TYPES = {
  ANALYZE_IMAGE: "AESTHETIC_LENS_ANALYZE_IMAGE",
  GET_ACTIVE_IMAGE: "AESTHETIC_LENS_GET_ACTIVE_IMAGE",
  GET_IMAGE_PAYLOAD_BY_URL: "AESTHETIC_LENS_GET_IMAGE_PAYLOAD_BY_URL"
};

const STORAGE_KEYS = {
  ACTIVE_IMAGE: "aestheticLensActiveImage"
};

const CONTEXT_MENU_ID = "aesthetic-lens-analyze-image";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: "用 Aesthetic Lens 分析图片",
    contexts: ["image"]
  });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // Older Chrome builds may not support this behavior flag yet.
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !info.srcUrl || !tab || !tab.id) {
    return;
  }

  handleContextMenuAnalyze(info, tab).catch(() => {
    // Context menu actions should fail silently on restricted pages.
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) {
    return false;
  }

  if (message.type === MESSAGE_TYPES.ANALYZE_IMAGE) {
    handleAnalyzeImage(message.payload, sender)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === MESSAGE_TYPES.GET_ACTIVE_IMAGE) {
    chrome.storage.local
      .get(STORAGE_KEYS.ACTIVE_IMAGE)
      .then((result) => sendResponse({ ok: true, image: result[STORAGE_KEYS.ACTIVE_IMAGE] || null }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function handleAnalyzeImage(payload, sender) {
  if (!payload || !payload.imageUrl) {
    throw new Error("Missing image payload.");
  }

  const tabId = sender.tab && sender.tab.id;
  if (!tabId) {
    throw new Error("Unable to identify the source tab.");
  }

  const selectedImage = {
    ...payload,
    selectedAt: new Date().toISOString()
  };

  const saveSelection = chrome.storage.local.set({
    [STORAGE_KEYS.ACTIVE_IMAGE]: selectedImage
  });

  await chrome.sidePanel.open({ tabId });
  await saveSelection;
}

async function handleContextMenuAnalyze(info, tab) {
  const tabId = tab.id;
  let payload = buildFallbackPayload(info, tab);

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: MESSAGE_TYPES.GET_IMAGE_PAYLOAD_BY_URL,
      srcUrl: info.srcUrl
    });

    if (response && response.ok && response.image) {
      payload = response.image;
    } else {
      return;
    }
  } catch (error) {
    // Content scripts are not available on chrome:// pages and some protected origins.
  }

  const saveSelection = saveActiveImage(payload);
  await chrome.sidePanel.open({ tabId });
  await saveSelection;
}

function buildFallbackPayload(info, tab) {
  return {
    imageUrl: info.srcUrl,
    pageUrl: tab.url || info.pageUrl || "",
    pageTitle: tab.title || "Untitled page",
    width: 0,
    height: 0,
    renderedWidth: 0,
    renderedHeight: 0,
    aspectRatio: "Unknown",
    alt: "",
    selectedAt: new Date().toISOString()
  };
}

function saveActiveImage(payload) {
  return chrome.storage.local.set({
    [STORAGE_KEYS.ACTIVE_IMAGE]: {
      ...payload,
      selectedAt: new Date().toISOString()
    }
  });
}
