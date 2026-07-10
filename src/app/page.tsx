import { redirect } from "next/navigation";
import { getRole } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function Home() {
  const role = await getRole();
  if (role === "writer") redirect("/writer");
  if (role === "viewer") redirect("/viewer");
  if (role === "display214") redirect("/display/214");
  if (role === "display215") redirect("/display/215");
  return <LoginForm />;
}

