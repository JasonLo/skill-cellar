import { Tabs } from './components/Tabs'
import { TitleBar } from './components/TitleBar'
import { LibraryScreen } from './screens/LibraryScreen'
import { ShopScreen } from './screens/ShopScreen'
import { UsageScreen } from './screens/UsageScreen'
import { AppProvider, useApp } from './state/AppContext'

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
      return (
        <div className="screen empty">
          This area is part of a later milestone.
        </div>
      )
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
