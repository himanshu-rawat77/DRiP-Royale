export type EscrowRegistrar = {
  markDepositReady: (roomId: string, playerId: string, wallet: string) => void;
  roomHasPlayer: (roomId: string, playerId: string) => boolean;
};

let registrar: EscrowRegistrar | null = null;

export function setEscrowRegistrar(next: EscrowRegistrar | null) {
  registrar = next;
}

export function getEscrowRegistrar(): EscrowRegistrar | null {
  return registrar;
}
