"use client";

import { useFormState } from "react-dom";
import { crewLoginAction, type CrewLoginFormState } from "./actions";

const initial: CrewLoginFormState = {};

export function CrewLoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction] = useFormState(crewLoginAction, initial);
  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-neutral-200 bg-white p-8 shadow-soft">
      <div className="space-y-2">
        <label htmlFor="key" className="block text-sm font-medium text-neutral-700">
          Crew key
        </label>
        <input
          id="key"
          name="key"
          type="password"
          required
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-base text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          placeholder="Enter crew key"
        />
      </div>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
      >
        Sign in
      </button>
    </form>
  );
}

