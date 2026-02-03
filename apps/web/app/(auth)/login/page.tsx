import Link from "next/link";
import { AuthForm } from "../components/auth-form";

export const metadata = {
  title: "Log in | Meerkat",
};

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <AuthForm variant="login" />
      <p className="text-center text-sm text-slate-500">
        Need an account?{" "}
        <Link href="/signup" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
