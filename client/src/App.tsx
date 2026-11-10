import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Book from "./pages/Book";
import Manage from "./pages/Manage";
import Find from "./pages/Find";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLogin from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Services from "./pages/admin/Services";
import Stylists from "./pages/admin/Stylists";
import Settings from "./pages/admin/Settings";
import Schedule from "./pages/admin/Schedule";
import Clients from "./pages/admin/Clients";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/zakazi" element={<Book />} />
        <Route path="/termin/:token" element={<Manage />} />
        <Route path="/nadji" element={<Find />} />
        <Route path="/admin/prijava" element={<AdminLogin />} />

        {/* Admin rute sa gnezdenjem - SVE OVO IDE UNUTAR ADMIN LAYOUT-A */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="kalendar" element={<Schedule />} />
          <Route path="klijenti" element={<Clients />} />
          <Route path="usluge" element={<Services />} />
          <Route path="frizeri" element={<Stylists />} />
          <Route path="podesavanja" element={<Settings />} />
        </Route> 

        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}