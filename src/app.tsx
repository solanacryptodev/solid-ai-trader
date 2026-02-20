import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, Show, createSignal } from "solid-js";
import { GlobalModalProvider, useGlobalModal } from "~/libs/context/GlobalModalContext";
import WatchlistModal from "~/components/dashboard/WatchlistModal";
import Nav from "~/components/Nav";
import "./app.css";

// Inner component that uses the global modal context
function AppContent(props: { children?: any }) {
  const { selectedToken, isOpen, closeWatchlistModal, onAnalyze } = useGlobalModal();
  const [copied, setCopied] = createSignal(false);

  // Image status for fallback display
  const [imageStatus, setImageStatus] = createSignal<Map<string, { loaded: boolean; failed: boolean }>>(new Map());

  function shouldShowFallback(itemId: string, icon: string): boolean {
    if (!icon.startsWith("http")) return true;
    const status = imageStatus().get(itemId);
    return status?.failed === true;
  }

  function handleImageError(itemId: string) {
    setImageStatus((prev) => {
      const newMap = new Map(prev);
      newMap.set(itemId, { loaded: false, failed: true });
      return newMap;
    });
  }

  async function copyAddress() {
    const token = selectedToken();
    if (token?.address) {
      try {
        await navigator.clipboard.writeText(token.address);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy address:", err);
      }
    }
  }

  return (
    <>
      <Nav />
      <Suspense>
        {props.children}
      </Suspense>

      {/* Global Watchlist Modal - positioned at root level */}
      <Show when={isOpen() && selectedToken()}>
        <WatchlistModal
          token={selectedToken()!}
          onClose={closeWatchlistModal}
          onCopy={copyAddress}
          copied={copied()}
          shouldShowFallback={shouldShowFallback}
          handleImageError={handleImageError}
          onAnalyze={onAnalyze()}
        />
      </Show>
    </>
  );
}

export default function App() {
  return (
    <GlobalModalProvider>
      <Router root={AppContent}>
        <FileRoutes />
      </Router>
    </GlobalModalProvider>
  );
}
