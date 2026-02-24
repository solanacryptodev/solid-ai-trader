/**
 * solana.ts
 * Solana Kit integration for devnet interaction.
 * Provides a simple interface for common Solana operations.
 *
 * Install:
 *   npm install @solana/kit @solana-program/memo
 *
 * Usage:
 *   import { solana } from "./solana";
 *   await solana.connect();
 *   await solana.sendMessage("Hello from devnet!");
 */

import {
    airdropFactory,
    appendTransactionMessageInstructions,
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    createTransactionMessage,
    devnet,
    generateKeyPairSigner,
    getSignatureFromTransaction,
    lamports,
    mainnet,
    pipe,
    sendAndConfirmTransactionFactory,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    type KeyPairSigner,
} from "@solana/kit";
import { getAddMemoInstruction } from "@solana-program/memo";

// ── Config ─────────────────────────────────────────────────────────────────────

const DEVNET_RPC_URL = process.env.SOLANA_DEVNET_RPC_URL as string;
const MAINNET_RPC_URL = process.env.SOLANA_MAINNET_RPC_URL as string;
const WS_URL = process.env.SOLANA_WS_URL as string;
const AIRDROP_AMOUNT = lamports(10_000_000n); // 0.01 SOL

// ── State ──────────────────────────────────────────────────────────────────────

let rpc: ReturnType<typeof createSolanaRpc> | null = null;
let rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions> | null = null;
let sendAndConfirmTransaction: ReturnType<typeof sendAndConfirmTransactionFactory> | null = null;
let signer: KeyPairSigner | null = null;

// ── Helpers ────────────────────────────────────────────────────────────────────

function getRpc() {
    if (!rpc) throw new Error("[Solana] Not connected — call solana.connect() first");
    return rpc;
}

function getSigner() {
    if (!signer) throw new Error("[Solana] No signer — call solana.connect() first");
    return signer;
}

function getSendAndConfirm() {
    if (!sendAndConfirmTransaction) throw new Error("[Solana] Not connected — call solana.connect() first");
    return sendAndConfirmTransaction;
}

// ── Connection ─────────────────────────────────────────────────────────────────

/** Connect to devnet and generate an ephemeral signer, funding it via airdrop */
export async function connect(network: string): Promise<void> {
    if (rpc) return; // already connected

    if (network === 'devnet') {
        rpc = createSolanaRpc(devnet(DEVNET_RPC_URL));
        rpcSubscriptions = createSolanaRpcSubscriptions(devnet(DEVNET_RPC_URL));
    } else {
        rpc = createSolanaRpc(mainnet(MAINNET_RPC_URL));
        rpcSubscriptions = createSolanaRpcSubscriptions(mainnet(MAINNET_RPC_URL));
    }
    sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
        rpc: rpc as any,
        rpcSubscriptions: rpcSubscriptions as any
    });

    signer = await generateKeyPairSigner();
    console.log(`[Solana] Connected to ${network}`);
    console.log(`[Solana] Wallet → ${signer.address}`);

    await airdropFactory({ rpc: rpc as any, rpcSubscriptions: rpcSubscriptions as any })({
        commitment: "confirmed",
        lamports: AIRDROP_AMOUNT,
        recipientAddress: signer.address,
    });

    console.log(`[Solana] Airdrop confirmed — wallet funded`);
}

export async function disconnect(): Promise<void> {
    rpc = null;
    rpcSubscriptions = null;
    sendAndConfirmTransaction = null;
    signer = null;
    console.log("[Solana] Disconnected");
}

// ── Transactions ───────────────────────────────────────────────────────────────

/** Send a memo message to devnet — returns the transaction signature */
export async function sendMessage(message: string): Promise<string> {
    const { value: latestBlockhash } = await getRpc().getLatestBlockhash().send();

    const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(getSigner(), tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(
            [getAddMemoInstruction({ memo: message })],
            tx
        )
    );

    const signedTx = await signTransactionMessageWithSigners(transactionMessage);
    await getSendAndConfirm()(signedTx as any, { commitment: "confirmed" });

    const signature = getSignatureFromTransaction(signedTx);
    console.log(`[Solana] Message sent → "${message}"`);
    console.log(`[Solana] Explorer: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

    return signature;
}

/** Get the current SOL balance of the connected wallet in lamports */
export async function getBalance(): Promise<bigint> {
    const { value } = await getRpc()
        .getBalance(getSigner().address, { commitment: "confirmed" })
        .send();
    console.log(`[Solana] Balance → ${value} lamports`);
    return value;
}

/** Get the connected wallet's public address */
export function getAddress(): string {
    return getSigner().address;
}

// ── Convenience export ─────────────────────────────────────────────────────────

export const solana = {
    connect,
    disconnect,
    sendMessage,
    getBalance,
    getAddress,
};
