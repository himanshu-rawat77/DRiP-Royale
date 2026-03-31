/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NEXT_PUBLIC_HELIUS_API_KEY?: string;
  readonly NEXT_PUBLIC_SOLANA_NETWORK?: string;
  readonly NEXT_PUBLIC_DRIP_CREATOR_ADDRESS?: string;
  readonly VITE_HELIUS_API_KEY?: string;
  readonly VITE_SOLANA_NETWORK?: string;
  readonly VITE_DRIP_CREATOR_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
