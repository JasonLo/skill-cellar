import { AppProvider, useApp } from './state/AppContext'
import { TitleBar } from './components/TitleBar'
import { Tabs } from './components/Tabs'
import { ShopScreen } from './screens/ShopScreen'
import { LibraryScreen } from './screens/LibraryScreen'
import { UsageScreen } from './screens/UsageScreen'

function ActiveScreen() {
  const { tab } = useApp()
  switch (tab) {
    case 'shop':
      return <ShopScreen />
    case 'library':
      return <LibraryScreen />
    case 'usage':
      return <UsageScreen />
    default:
      return <div className="screen empty">This area is part of a later milestone.</div>
  }
}

export default function App() {
  return (
    <AppProvider>
      <div className="app">
        <TitleBar />
        <Tabs />
        <main className="content">
          <ActiveScreen />
        </main>
      </div>
    </AppProvider>
  )
}
