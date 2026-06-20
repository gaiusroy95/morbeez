import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './router';
import { WebNetworkBanner, WebNetworkProvider } from './components/WebNetworkBanner';

export default function App() {
  return (
    <WebNetworkProvider>
      <AuthProvider>
        <WebNetworkBanner />
        <AppRouter />
      </AuthProvider>
    </WebNetworkProvider>
  );
}
