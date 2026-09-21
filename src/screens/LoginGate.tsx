import React from 'react';
import PinGate from './PinGate';

const PIN_HASH = '744b93f9950fc38dad705556931ea48193b99dcb191cc9bd77097f65fbe2f0b8';
const STORAGE_KEY = 'datalens_unlocked';

interface LoginGateProps {
  children: React.ReactNode;
}

const LoginGate: React.FC<LoginGateProps> = ({ children }) => (
  <PinGate pinHash={PIN_HASH} storageKey={STORAGE_KEY}>
    {children}
  </PinGate>
);

export default LoginGate;
