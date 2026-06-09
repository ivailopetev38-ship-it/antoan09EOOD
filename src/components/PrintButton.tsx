'use client';

export function PrintButton() {
  return (
    <button className="btn btn-fire" onClick={() => window.print()}>
      🖨️ Печат
    </button>
  );
}
