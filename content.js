(function () {
  const MESSAGE_TYPES = {
    GET_IMAGE_PAYLOAD_BY_URL: "AESTHETIC_LENS_GET_IMAGE_PAYLOAD_BY_URL"
  };

  const MIN_IMAGE_SIZE = 120;
  const SCAN_DEBOUNCE_MS = 250;

  const trackedImages = new WeakSet();
  let scanTimer = null;
  let lastContextImage = null;

  scanImages();
  observeDynamicImages();
  document.addEventListener("contextmenu", rememberContextImage, true);
  chrome.runtime.onMessage.addListener(handleRuntimeMessage);

  function scanImages(root = document) {
    const images = root instanceof HTMLImageElement ? [root] : Array.from(root.querySelectorAll("img"));

    images.forEach((image) => {
      if (trackedImages.has(image)) {
        return;
      }

      trackedImages.add(image);
    });
  }

  function observeDynamicImages() {
    const observer = new MutationObserver((mutations) => {
      let shouldScan = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType !== Node.ELEMENT_NODE) {
            return;
          }

          if (node instanceof HTMLImageElement || node.querySelector("img")) {
            shouldScan = true;
          }
        });
      });

      if (shouldScan) {
        debounceScan();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function debounceScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scanImages, SCAN_DEBOUNCE_MS);
  }

  function isValidImage(image) {
    if (!image || !image.isConnected) {
      return false;
    }

    const rect = image.getBoundingClientRect();
    const renderedWidth = Math.round(rect.width);
    const renderedHeight = Math.round(rect.height);
    const naturalWidth = image.naturalWidth || renderedWidth;
    const naturalHeight = image.naturalHeight || renderedHeight;
    const isLargeEnough = renderedWidth >= MIN_IMAGE_SIZE
      && renderedHeight >= MIN_IMAGE_SIZE
      && naturalWidth >= MIN_IMAGE_SIZE
      && naturalHeight >= MIN_IMAGE_SIZE;

    return Boolean(image.currentSrc || image.src)
      && isLargeEnough
      && rect.bottom > 0
      && rect.right > 0
      && rect.top < window.innerHeight
      && rect.left < window.innerWidth;
  }

  function rememberContextImage(event) {
    const image = event.target && event.target.closest && event.target.closest("img");
    lastContextImage = image instanceof HTMLImageElement ? image : null;
  }

  function handleRuntimeMessage(message, sender, sendResponse) {
    if (!message || message.type !== MESSAGE_TYPES.GET_IMAGE_PAYLOAD_BY_URL) {
      return false;
    }

    const image = findImageByUrl(message.srcUrl);
    if (!image || !isValidImage(image)) {
      sendResponse({ ok: false, error: "Image not found or too small." });
      return false;
    }

    sendResponse({ ok: true, image: buildImagePayload(image) });
    return false;
  }

  function findImageByUrl(srcUrl) {
    if (lastContextImage && imageMatchesUrl(lastContextImage, srcUrl)) {
      return lastContextImage;
    }

    return Array.from(document.images).find((image) => imageMatchesUrl(image, srcUrl)) || null;
  }

  function imageMatchesUrl(image, srcUrl) {
    return image.currentSrc === srcUrl || image.src === srcUrl;
  }

  function buildImagePayload(image) {
    const rect = image.getBoundingClientRect();
    const width = image.naturalWidth || Math.round(rect.width);
    const height = image.naturalHeight || Math.round(rect.height);

    return {
      imageUrl: image.currentSrc || image.src,
      pageUrl: window.location.href,
      pageTitle: document.title || "Untitled page",
      width,
      height,
      renderedWidth: Math.round(rect.width),
      renderedHeight: Math.round(rect.height),
      aspectRatio: formatAspectRatio(width, height),
      alt: image.alt || ""
    };
  }

  function formatAspectRatio(width, height) {
    if (!width || !height) {
      return "Unknown";
    }

    const divisor = greatestCommonDivisor(width, height);
    return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
  }

  function greatestCommonDivisor(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);

    while (y) {
      const temp = y;
      y = x % y;
      x = temp;
    }

    return x || 1;
  }
})();
