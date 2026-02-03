import Link from "next/link";
import { AuthForm } from "../components/auth-form";

export const metadata = {
  title: "Sign up | Meerkat",
};

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <AuthForm variant="signup" />
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
