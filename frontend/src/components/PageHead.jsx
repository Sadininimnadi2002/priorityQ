export default function PageHead({ title, subtitle, children }) {
  return (
    <header className="pq-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="d-flex flex-wrap gap-2 align-items-center">{children}</div>}
    </header>
  );
}
