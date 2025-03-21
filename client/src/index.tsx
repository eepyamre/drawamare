import { createContext, render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Header } from '@/components';
import { Home } from '@/pages/Home';
import { NotFound } from './pages/_404';
import { createAppState } from './state';
import './style.scss';

export const AppState = createContext(createAppState());

export function App() {
  return (
    <LocationProvider>
      <AppState.Provider value={createAppState()}>
        <Header />
        <main>
          <Router>
            <Route path='/' component={Home} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </AppState.Provider>
    </LocationProvider>
  );
}

render(<App />, document.getElementById('app'));
