// src/services/leanCallbackManager.ts

type LeanCallback = (response: any) => void;

class LeanCallbackManager {
    private static instance: LeanCallbackManager;
    private callback: LeanCallback | null = null;
    private isProcessing = false;

    static getInstance(): LeanCallbackManager {
        if (!LeanCallbackManager.instance) {
            LeanCallbackManager.instance = new LeanCallbackManager();
        }
        return LeanCallbackManager.instance;
    }

    setCallback(callback: LeanCallback) {
        this.callback = callback;
        // ✅ Updated: Use LeanV2 (V2 SDK) instead of Lean (V1 SDK)
        if (typeof window !== 'undefined' && window.LeanV2) {
            // V2 SDK uses callback inside the config, not as a global assignment.
            // For backward compatibility, we still keep this but it's not used by V2.
            // The actual callback is now passed inside the config object.
            console.log('🔄 Lean V2 SDK detected. Callbacks are now configured in the connect() config.');
        }
    }

    clearCallback() {
        this.callback = null;
        this.isProcessing = false;
    }

    isProcessingConnection(): boolean {
        return this.isProcessing;
    }

    setProcessing(processing: boolean) {
        this.isProcessing = processing;
    }
}

export default LeanCallbackManager.getInstance();