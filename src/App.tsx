import { useKeyboard } from './hooks/useKeyboard'
import Toolbar from './components/Toolbar/Toolbar'
import PDFViewer from './components/PDFViewer/PDFViewer'
import Sidebar from './components/Sidebar/Sidebar'
import AIDialog from './components/AIDialog/AIDialog'
import SelectionPopup from './components/ChatPanel/SelectionPopup'
import ChatPanel from './components/ChatPanel/ChatPanel'

export default function App() {
  useKeyboard()

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <PDFViewer />
        <Sidebar />
      </div>
      <SelectionPopup />
      <ChatPanel />
      <AIDialog />
    </div>
  )
}
