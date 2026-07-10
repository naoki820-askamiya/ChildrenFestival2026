import { redirect } from "next/navigation"; import { getRole } from "@/lib/auth"; import ViewerDashboard from "@/components/ViewerDashboard";
export default async function ViewerPage() { if ((await getRole()) !== "viewer") redirect("/"); return <ViewerDashboard/>; }

