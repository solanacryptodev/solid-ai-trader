/**
 * rsi.ts
 * Full RSI implementation with smoothing line (EMA or SMA)
 */

export type SmoothingType = "EMA" | "SMA";

export interface RSIResult {
    rsi: number;
    signal: "oversold" | "overbought" | "neutral";
    smoothingLine: number | null;
    crossover: "above_signal" | "below_signal" | null;
    length: number;
    smoothingLength: number;
    smoothingType: SmoothingType;
    insufficientData: boolean;
    samplesHave: number;
    samplesNeed: number;
}

function calculateRSIValues(prices: number[], length: number): number[] {
    if (prices.length < length + 1) return [];

    const deltas = prices.map((p, i) => (i === 0 ? null : p - prices[i - 1])).slice(1) as number[];
    const gains = deltas.map((d) => (d > 0 ? d : 0));
    const losses = deltas.map((d) => (d < 0 ? -d : 0));

    let avgGain = gains.slice(0, length).reduce((a, b) => a + b, 0) / length;
    let avgLoss = losses.slice(0, length).reduce((a, b) => a + b, 0) / length;

    const rsiValues: number[] = [];

    for (let i = length; i < deltas.length; i++) {
        avgGain = (avgGain * (length - 1) + gains[i]) / length;
        avgLoss = (avgLoss * (length - 1) + losses[i]) / length;
        const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
        const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
        rsiValues.push(rsi);
    }

    console.log("RSI Values:", rsiValues);

    return rsiValues;
}

function calculateEMA(values: number[], length: number): number | null {
    if (values.length < length) return null;
    const k = 2 / (length + 1);
    let ema = values.slice(0, length).reduce((a, b) => a + b, 0) / length;
    for (let i = length; i < values.length; i++) {
        ema = values[i] * k + ema * (1 - k);
    }
    return ema;
}

function calculateSMA(values: number[], length: number): number | null {
    if (values.length < length) return null;
    const slice = values.slice(-length);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function getFullRSI(
    prices: number[],
    length = 14,
    smoothingLength = 9,
    smoothingType: SmoothingType = "EMA"
): RSIResult {
    const samplesNeed = length + smoothingLength + 1;

    if (prices.length < samplesNeed) {
        return {
            rsi: 0,
            signal: "neutral",
            smoothingLine: null,
            crossover: null,
            length,
            smoothingLength,
            smoothingType,
            insufficientData: true,
            samplesHave: prices.length,
            samplesNeed,
        };
    }

    const rsiValues = calculateRSIValues(prices, length);
    const currentRSI = rsiValues.at(-1)!;

    const smoothingLine =
        smoothingType === "EMA"
            ? calculateEMA(rsiValues, smoothingLength)
            : calculateSMA(rsiValues, smoothingLength);

    const signal: RSIResult["signal"] =
        currentRSI < 30 ? "oversold" : currentRSI > 70 ? "overbought" : "neutral";

    const crossover: RSIResult["crossover"] = smoothingLine
        ? currentRSI > smoothingLine
            ? "above_signal"
            : "below_signal"
        : null;

    return {
        rsi: parseFloat(currentRSI.toFixed(2)),
        signal,
        smoothingLine: smoothingLine !== null ? parseFloat(smoothingLine.toFixed(2)) : null,
        crossover,
        length,
        smoothingLength,
        smoothingType,
        insufficientData: false,
        samplesHave: prices.length,
        samplesNeed,
    };
}

/** Returns the last N RSI values for charting */
export function getRSIHistory(prices: number[], length = 14, count = 50): number[] {
    const all = calculateRSIValues(prices, length);
    return all.slice(-count);
}
