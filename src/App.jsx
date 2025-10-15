import TokenSwap from "./TokenSwap";
import {
  NetworkId,
  WalletId,
  WalletManager,
  WalletProvider,
} from "@txnlab/use-wallet-react";
import { WalletUIProvider } from "@txnlab/use-wallet-ui-react";

// Optional: Import pre-built styles if not using Tailwind
import "@txnlab/use-wallet-ui-react/dist/style.css";

// Configure the wallets you want to use
const walletManager = new WalletManager({
  wallets: [WalletId.PERA, WalletId.LUTE],
  defaultNetwork: NetworkId.MAINNET,
  options: { resetNetwork: true },
});

function App() {
  return (
    <WalletProvider manager={walletManager}>
      <WalletUIProvider>
        <TokenSwap />
      </WalletUIProvider>
    </WalletProvider>
  );
}

export default App;
