import { redirect } from "next/navigation"; import { getRole } from "@/lib/auth"; import WriterDashboard from "@/components/WriterDashboard";
export default async function WriterPage() { if ((await getRole()) !== "writer") redirect("/"); return <WriterDashboard/>; }

