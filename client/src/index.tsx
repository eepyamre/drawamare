import { createContext, render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Header } from '@/components';
import { Home } from '@/pages/Home';
import { NotFound } from './pages/_404';
import './style.scss';
import { createLayersState } from './state';

export const LayersState = createContext(createLayersState());

export function App() {
  return (
    <LocationProvider>
      <LayersState.Provider value={createLayersState()}>
        <Header />
        <main>
          <Router>
            <Route path='/' component={Home} />
            <Route default component={NotFound} />
          </Router>
        </main>
      </LayersState.Provider>
    </LocationProvider>
  );
}

render(<App />, document.getElementById('app'));
