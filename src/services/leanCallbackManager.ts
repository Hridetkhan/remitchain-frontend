// frontend/src/services/leanCallbackManager.ts

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
        // Register the global callback
        if (typeof window !== 'undefined' && window.Lean) {
            window.Lean.callback = (response: any) => {
                console.log('📨 Global Lean callback received:', response);
                this.isProcessing = false;
                if (this.callback) {
                    this.callback(response);
                }
            };
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