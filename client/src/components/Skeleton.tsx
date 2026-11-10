export const Skeleton = ({ n = 3, h = "h-20" }: { n?: number; h?: string }) => (
  <div className="space-y-2" aria-busy="true" aria-label="Učitavanje">
    {Array.from({ length: n }, (_, i) => <div key={i} className={`skeleton rounded-xl ${h}`} />)}
  </div>
);