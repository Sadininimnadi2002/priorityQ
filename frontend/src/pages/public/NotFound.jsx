import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="pq-panel pq-empty">
      <h2>This page does not exist</h2>
      <p>Check the address, or go back to the start.</p>
      <Link to="/" className="btn btn-primary">
        Go to home
      </Link>
    </div>
  );
}
