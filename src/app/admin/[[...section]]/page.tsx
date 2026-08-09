import AdminDashboardPage from "../section/admin-dashboard";
import { redirect } from "next/navigation";

export default function AdminRoutePage() {
	redirect("/admin/analytics");
	return <AdminDashboardPage />;
}