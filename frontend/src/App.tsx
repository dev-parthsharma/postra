import AppRouter from "./AppRouter";
import { ThemeProvider } from "./context/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <AppRouter />
      </div>
    </ThemeProvider>
  );
}

export default App;