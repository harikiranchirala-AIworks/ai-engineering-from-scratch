import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            borderRadius: "0px",
            border: "1px solid #111111",
            background: "#111111",
            color: "#F4F4F0",
            fontFamily: "'JetBrains Mono', monospace",
            boxShadow: "4px 4px 0px 0px rgba(0,47,167,1)",
          },
        }}
      />
    </div>
  );
}

export default App;
