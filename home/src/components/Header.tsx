import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

export function Header() {
  return (
    <header className="os-header">
      <div className="os-header__content">
        <div>
          <p className="os-kicker">Encrypted commerce</p>
          <h1 className="os-title">Oblivion Store</h1>
          <p className="os-subtitle">
            Name your store, encrypt your stock, and keep quantities private with Zama FHE.
          </p>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
