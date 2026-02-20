import { createContext, useContext, createSignal, ParentComponent, Accessor } from "solid-js";

// Token shield warning interface
interface TokenShieldWarning {
    type: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    source: string;
}

// Watchlist item interface
interface WatchlistItem {
    id: string;
    name: string;
    token: string;
    icon: string;
    price: string;
    change: string;
    changeColor: string;
    score?: number;
    holders?: number;
    address: string;
    signals?: string[];
    warnings?: TokenShieldWarning[];
}

interface GlobalModalContextValue {
    selectedToken: Accessor<WatchlistItem | null>;
    isOpen: Accessor<boolean>;
    openWatchlistModal: (token: WatchlistItem) => void;
    closeWatchlistModal: () => void;
    onAnalyze: Accessor<((token: WatchlistItem) => void) | undefined>;
    setOnAnalyze: (callback: ((token: WatchlistItem) => void) | undefined) => void;
}

const GlobalModalContext = createContext<GlobalModalContextValue>();

export const GlobalModalProvider: ParentComponent = (props) => {
    const [selectedToken, setSelectedToken] = createSignal<WatchlistItem | null>(null);
    const [isOpen, setIsOpen] = createSignal(false);
    const [onAnalyze, setOnAnalyze] = createSignal<((token: WatchlistItem) => void) | undefined>(undefined);

    const openWatchlistModal = (token: WatchlistItem) => {
        setSelectedToken(token);
        setIsOpen(true);
    };

    const closeWatchlistModal = () => {
        setSelectedToken(null);
        setIsOpen(false);
    };

    return (
        <GlobalModalContext.Provider value={{
            selectedToken,
            isOpen,
            openWatchlistModal,
            closeWatchlistModal,
            onAnalyze,
            setOnAnalyze
        }}>
            {props.children}
        </GlobalModalContext.Provider>
    );
};

export function useGlobalModal() {
    const context = useContext(GlobalModalContext);
    if (!context) {
        throw new Error("useGlobalModal must be used within a GlobalModalProvider");
    }
    return context;
}
