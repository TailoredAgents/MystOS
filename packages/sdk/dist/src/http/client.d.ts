import { type LeadIntakeRequest, type LeadIntakeResponse, type QuoteRequest, type QuoteResponse, type PayDepositRequest, type PayDepositResponse } from "../schemas";
export interface MystClientConfig {
    baseUrl?: string;
    fetchImpl?: typeof fetch;
    defaultHeaders?: Record<string, string>;
}
export declare class MystSDK {
    private readonly config;
    constructor(config?: MystClientConfig);
    leadIntake(input: LeadIntakeRequest): Promise<LeadIntakeResponse>;
    quoteRequest(input: QuoteRequest): Promise<QuoteResponse>;
    payDeposit(input: PayDepositRequest): Promise<PayDepositResponse>;
}
//# sourceMappingURL=client.d.ts.map