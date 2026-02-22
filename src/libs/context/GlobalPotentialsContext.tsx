import { createContext, useContext, createSignal, ParentComponent, Accessor } from "solid-js";
import type { PotentialToken, WatchlistItem } from "~/libs/interfaces";

interface GlobalPotentialsContextValue {
    // State
    potentials: Accessor<PotentialToken[]>;

    // Actions - add token from WatchlistItem (after analysis)
    addPotentialFromWatchlist: (token: WatchlistItem) => void;

    // Actions - add token directly from PotentialToken
    addPotential: (token: PotentialToken) => void;

    // Remove a potential by ID
    removePotential: (id: string) => void;

    // Check if token is already in potentials
    isPotential: (id: string) => boolean;

    // Clear all potentials
    clearPotentials: () => void;
}

const GlobalPotentialsContext = createContext<GlobalPotentialsContextValue>();

export const GlobalPotentialsProvider: ParentComponent = (props) => {
    const [potentials, setPotentials] = createSignal<PotentialToken[]>([]);

    // Convert WatchlistItem to PotentialToken and add to potentials
    const addPotentialFromWatchlist = (token: WatchlistItem) => {
        const newPotential: PotentialToken = {
            id: token?.id || "",
            name: token?.name || "",
            symbol: token?.token || "",
            icon: token?.icon || "",
            address: token?.address || "",
        };

        // console.log("Adding potential from watchlist:", newPotential);
        // Only add if not already in the list
        setPotentials((prev) => {
            if (prev.some((p) => p.id === newPotential.id)) {
                return prev;
            }
            return [...prev, newPotential];
        });
        // console.log("Potentials after adding:", potentials());
    };

    // Add a PotentialToken directly (for AI agent tool calls)
    const addPotential = (token: PotentialToken) => {
        setPotentials((prev) => {
            if (prev.some((p) => p.id === token.id)) {
                return prev;
            }
            return [...prev, token];
        });
    };

    // Remove a potential by ID
    const removePotential = (id: string) => {
        setPotentials((prev) => prev.filter((p) => p.id !== id));
    };

    // Check if token is already in potentials
    const isPotential = (id: string) => {
        return potentials().some((p) => p.id === id);
    };

    // Clear all potentials
    const clearPotentials = () => {
        setPotentials([]);
    };

    return (
        <GlobalPotentialsContext.Provider value={{
            potentials,
            addPotentialFromWatchlist,
            addPotential,
            removePotential,
            isPotential,
            clearPotentials
        }}>
            {props.children}
        </GlobalPotentialsContext.Provider>
    );
};

export function useGlobalPotentials() {
    const context = useContext(GlobalPotentialsContext);
    if (!context) {
        throw new Error("useGlobalPotentials must be used within a GlobalPotentialsProvider");
    }
    return context;
}
