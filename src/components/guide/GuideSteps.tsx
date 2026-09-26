export type GuideStep = {
  title: string;
  description: string;
};

export function GuideSteps({
  heading,
  intro,
  steps,
}: {
  heading: string;
  intro?: string;
  steps: GuideStep[];
}) {
  return (
    <main className="p-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Guide</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{heading}</h1>
        {intro ? <p className="mt-1 max-w-xl text-sm text-slate-500">{intro}</p> : null}
      </div>

      <ol className="mt-6 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="card flex gap-4 p-5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {i + 1}
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{step.title}</h2>
              <p className="mt-1 text-sm text-slate-500">{step.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
