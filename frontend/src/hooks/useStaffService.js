import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { servicesApi } from '../services/endpoints';

const KEY = 'pq_admin_service';

// Which service should the staff pages show?
export default function useStaffService() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [services, setServices] = useState([]);
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(KEY) || '');
  const [loaded, setLoaded] = useState(!isAdmin);

  useEffect(() => {
    if (!isAdmin) return;
    servicesApi
      .list({ includeInactive: true })
      .then((res) => {
        setServices(res.services);
        const stillExists = res.services.some((s) => s._id === localStorage.getItem(KEY));
        if (!stillExists && res.services.length) setSelectedId(res.services[0]._id);
      })
      .catch(() => setServices([]))
      .finally(() => setLoaded(true));
  }, [isAdmin]);

  const choose = (id) => {
    setSelectedId(id);
    localStorage.setItem(KEY, id);
  };

  const serviceId = isAdmin ? selectedId : user?.assignedService?._id || null;

  return { isAdmin, services, serviceId, choose, assignedService: user?.assignedService, loaded };
}
