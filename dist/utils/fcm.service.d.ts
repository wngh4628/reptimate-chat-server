export declare class FCMService {
    private fcm;
    constructor();
    sendFCM(type: string, fbTokens: string, title: string, description: string): Promise<void>;
}
