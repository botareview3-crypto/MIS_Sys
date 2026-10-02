export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-stone-50 to-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-semibold text-white">
            A
          </div>
          <h1 className="text-xl font-semibold text-stone-900">AUC MIS Repair Management</h1>
          <p className="mt-1 text-sm text-stone-500">Account recovery</p>
        </div>

        <div className="card space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">Forgot password?</h2>
            <p className="mt-1 text-sm text-stone-500">
              For security, passwords can only be reset by a system administrator. Please contact your Admin and
              give them your username. They will either set a new password for you or send you a one-time reset
              link that works for 1 hour.
            </p>
          </div>

          <a href="/login" className="btn-primary block text-center">
            Back to login
          </a>
        </div>
      </div>
    </main>
  );
}
