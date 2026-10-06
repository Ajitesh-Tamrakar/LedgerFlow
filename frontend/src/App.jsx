import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import Dashboard from "./pages/Dashboard/Dashboard";
import Payments from "./pages/Payments/Payments"
import Cashbook from "./pages/Cashbook/Cashbook"
import Dealers from "./pages/Dealers/Dealers"
import Bills from "./pages/Bills/Bills"
import Settings from './pages/Settings/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<Dashboard />}/>
        <Route path="/payments" element={<Payments/>}/>
        <Route path="/cashbook" element={<Cashbook/>}/>
        <Route path="/dealers" element={<Dealers/>}/>
        <Route path="/settings" element={<Settings />}/>
        <Route path="/bills" element={<Bills/>}/>        
      </Routes>
    </BrowserRouter>
  );
}

export default App;
