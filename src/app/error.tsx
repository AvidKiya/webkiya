"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone">
      <h1>یه مشکلی پیش اومد</h1>
      <p>دوباره امتحان کن؛ اطلاعات سبد در مرورگر باقی می‌ماند.</p>
      <button className="primary" onClick={reset}>
        تلاش دوباره
      </button>
    </main>
  );
}
