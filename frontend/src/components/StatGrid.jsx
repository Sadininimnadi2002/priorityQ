// A row of numbers. items = [{ label, value, alert }]
export default function StatGrid({ items }) {
  return (
    <div className="pq-stats">
      {items.map((item) => (
        <div className={`pq-stat ${item.alert ? 'pq-stat--alert' : ''}`} key={item.label}>
          <div className="pq-stat__label">{item.label}</div>
          <div className="pq-stat__value">{item.value}</div>
        </div>
      ))}
    </div>
  );
}
