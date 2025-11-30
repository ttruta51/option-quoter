// Type declarations for black-scholes package
declare module 'black-scholes' {
    export function delta(
        s: number,
        k: number,
        t: number,
        v: number,
        r: number,
        callPut: 'call' | 'put'
    ): number;

    export function d1(
        s: number,
        k: number,
        t: number,
        v: number,
        r: number
    ): number;

    export default {
        delta,
        d1
    };
}
