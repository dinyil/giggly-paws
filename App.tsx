import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StoreProvider } from './context/StoreContext';
import { BroadcastProvider } from './context/BroadcastContext';
import { DeviceGuard } from './components/DeviceGuard';
import Layout from './components/Layout';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Grooming from './pages/Grooming';
import Clients from './pages/Clients';
import Transactions from './pages/Transactions';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Discounts from './pages/Discounts';
import Reports from './pages/Reports';
import Hotel from './pages/Hotel';

const App: React.FC = () => {
  return (
    <StoreProvider>
      <BroadcastProvider>
        <HashRouter>
          <DeviceGuard>
            <Routes>
              <Route path="/setup" element={<Setup />} />
              <Route path="/" element={<Login />} />
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/grooming" element={<Grooming />} />
                <Route path="/hotel" element={<Hotel />} />
                <Route path="/clients" element={<Clients />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/discounts" element={<Discounts />} />
                <Route path="/logs" element={<Logs />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/users" element={<Users />} />
                <Route path="/reports" element={<Reports />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </DeviceGuard>
        </HashRouter>
      </BroadcastProvider>
    </StoreProvider>
  );
};

export default App;