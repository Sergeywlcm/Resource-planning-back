import { useEffect, useMemo, useState } from 'react';
import wlcmLogo from './assets/Green_Logo.png';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

const defaultResourceForm = {
  name: '',
  capacity_hours: '8',
  is_active: true
};

const defaultProjectForm = {
  name: '',
  color: '#346a55',
  hours_type: 'BILLABLE',
  is_active: true
};

const defaultAllocationForm = {
  resource_id: '',
  project_id: '',
  start_date: '',
  end_date: '',
  hours_per_day: ''
};

function statusLabel(isActive) {
  return isActive ? 'Active' : 'Inactive';
}

function hoursTypeLabel(hoursType) {
  return hoursType === 'NON_BILLABLE' ? 'Non billable' : 'Billable';
}

function toDateInputValue(rawValue) {
  if (!rawValue) {
    return '';
  }

  if (typeof rawValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    return rawValue;
  }

  return new Date(rawValue).toISOString().slice(0, 10);
}

function toLocalDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDateRange(startDate, endDate) {
  return `${toDateInputValue(startDate)} -> ${toDateInputValue(endDate)}`;
}

function getDefaultRange() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + 13);

  return {
    startDate: toLocalDateInputValue(start),
    endDate: toLocalDateInputValue(end)
  };
}

function parseDateInputAsUtc(dateInput) {
  return new Date(`${dateInput}T00:00:00.000Z`);
}

function isWeekday(date) {
  const day = date.getUTCDay();
  return day !== 0 && day !== 6;
}

function getWeekdaysInRange(startDate, endDate) {
  const rangeStart = parseDateInputAsUtc(startDate);
  const rangeEnd = parseDateInputAsUtc(endDate);

  if (!startDate || !endDate || Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd < rangeStart) {
    return [];
  }

  const days = [];
  const cursor = new Date(rangeStart);

  while (cursor <= rangeEnd) {
    if (isWeekday(cursor)) {
      days.push({
        key: cursor.toISOString(),
        date: toDateInputValue(cursor),
        label: cursor.toLocaleDateString(undefined, {
          timeZone: 'UTC',
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

function getProjectSlotTitle(projectBreakdown) {
  if (!projectBreakdown.length) {
    return '';
  }

  return projectBreakdown
    .map((project) => `${project.project_name ?? 'Unknown project'}: ${project.hours}h`)
    .join('\n');
}

function getProjectSlotStyle(projectBreakdown) {
  if (!projectBreakdown.length) {
    return undefined;
  }

  if (projectBreakdown.length === 1) {
    const color = projectBreakdown[0].project_color ?? '#346a55';

    return {
      '--slot-color': color,
      '--slot-background': color
    };
  }

  const totalHours = projectBreakdown.reduce((total, project) => total + Number(project.hours ?? 0), 0);
  let cursor = 0;
  const segments = projectBreakdown.map((project) => {
    const color = project.project_color ?? '#346a55';
    const start = cursor;
    const width = totalHours > 0 ? (Number(project.hours ?? 0) / totalHours) * 100 : 0;
    cursor += width;

    return `${color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  });

  return {
    '--slot-color': projectBreakdown[0].project_color ?? '#346a55',
    '--slot-background': `linear-gradient(90deg, ${segments.join(', ')})`
  };
}

export default function App() {
  const initialSetupToken = new URLSearchParams(window.location.search).get('setup_token') ?? '';
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('rp_auth_token') ?? '');
  const [currentUser, setCurrentUser] = useState(null);
  const [loginFormData, setLoginFormData] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [setupToken, setSetupToken] = useState(initialSetupToken);
  const [passwordSetupFormData, setPasswordSetupFormData] = useState({ password: '', confirm_password: '' });
  const [passwordSetupError, setPasswordSetupError] = useState('');
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const [resources, setResources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [users, setUsers] = useState([]);

  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingAllocations, setLoadingAllocations] = useState(true);

  const [resourceError, setResourceError] = useState('');
  const [projectError, setProjectError] = useState('');
  const [allocationError, setAllocationError] = useState('');
  const [userError, setUserError] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [resourceFormData, setResourceFormData] = useState(defaultResourceForm);
  const [editingResourceId, setEditingResourceId] = useState('');
  const [isSavingResource, setIsSavingResource] = useState(false);
  const [resourceFormError, setResourceFormError] = useState('');
  const [resourceFormSuccess, setResourceFormSuccess] = useState('');

  const [projectFormData, setProjectFormData] = useState(defaultProjectForm);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState('');
  const [projectFormSuccess, setProjectFormSuccess] = useState('');

  const [allocationFormData, setAllocationFormData] = useState(defaultAllocationForm);
  const [editingAllocationId, setEditingAllocationId] = useState('');
  const [isSavingAllocation, setIsSavingAllocation] = useState(false);
  const [allocationFormError, setAllocationFormError] = useState('');
  const [allocationFormSuccess, setAllocationFormSuccess] = useState('');
  const [userFormData, setUserFormData] = useState({ email: '' });
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [userFormError, setUserFormError] = useState('');
  const [userFormSuccess, setUserFormSuccess] = useState('');
  const [latestInviteUrl, setLatestInviteUrl] = useState('');
  const [userPendingRemoval, setUserPendingRemoval] = useState(null);
  const [isRemovingUser, setIsRemovingUser] = useState(false);

  const [activeView, setActiveView] = useState('project-list');
  const [createModal, setCreateModal] = useState('');
  const [resourceViewRange, setResourceViewRange] = useState(getDefaultRange);
  const [resourceViewData, setResourceViewData] = useState({ resources: [] });
  const [isLoadingResourceView, setIsLoadingResourceView] = useState(false);
  const [resourceViewError, setResourceViewError] = useState('');
  const [resourceSearchText, setResourceSearchText] = useState('');
  const [selectedProjectFilterId, setSelectedProjectFilterId] = useState('');
  const [selectedResourceDay, setSelectedResourceDay] = useState(null);

  const [projectViewProjectId, setProjectViewProjectId] = useState('');
  const [projectViewRange, setProjectViewRange] = useState(getDefaultRange);
  const [projectViewData, setProjectViewData] = useState({ resources: [], daily_totals: [] });
  const [isLoadingProjectView, setIsLoadingProjectView] = useState(false);
  const [projectViewError, setProjectViewError] = useState('');
  const [projectViewResourceSearchText, setProjectViewResourceSearchText] = useState('');

  const isResourceEditMode = useMemo(() => Boolean(editingResourceId), [editingResourceId]);
  const isProjectEditMode = useMemo(() => Boolean(editingProjectId), [editingProjectId]);
  const isAllocationEditMode = useMemo(() => Boolean(editingAllocationId), [editingAllocationId]);

  const resourceNameById = useMemo(() => {
    return resources.reduce((acc, resource) => {
      acc[resource.id] = resource.name;
      return acc;
    }, {});
  }, [resources]);

  const projectNameById = useMemo(() => {
    return projects.reduce((acc, project) => {
      acc[project.id] = project.name;
      return acc;
    }, {});
  }, [projects]);

  async function loadResources() {
    setLoadingResources(true);
    setResourceError('');

    try {
      const response = await apiFetch(`${apiBaseUrl}/resources`);
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload?.data)) {
        throw new Error(payload?.error?.message ?? 'Unable to load resources.');
      }

      setResources(payload.data);
    } catch (error) {
      setResourceError(error.message);
    } finally {
      setLoadingResources(false);
    }
  }

  async function loadProjects() {
    setLoadingProjects(true);
    setProjectError('');

    try {
      const response = await apiFetch(`${apiBaseUrl}/projects`);
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload?.data)) {
        throw new Error(payload?.error?.message ?? 'Unable to load projects.');
      }

      setProjects(payload.data);
    } catch (error) {
      setProjectError(error.message);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadAllocations() {
    setLoadingAllocations(true);
    setAllocationError('');

    try {
      const response = await apiFetch(`${apiBaseUrl}/allocations`);
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload?.data)) {
        throw new Error(payload?.error?.message ?? 'Unable to load allocations.');
      }

      setAllocations(payload.data);
    } catch (error) {
      setAllocationError(error.message);
    } finally {
      setLoadingAllocations(false);
    }
  }

  async function loadResourceView() {
    const { startDate, endDate } = resourceViewRange;

    if (!startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      setResourceViewData({ resources: [] });
      setSelectedResourceDay(null);
      return;
    }

    setIsLoadingResourceView(true);
    setResourceViewError('');

    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const response = await apiFetch(`${apiBaseUrl}/resources/workload?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload?.data || !Array.isArray(payload.data.resources)) {
        throw new Error(payload?.error?.message ?? 'Unable to load resource view workload.');
      }

      setResourceViewData(payload.data);
      setSelectedResourceDay(null);
    } catch (error) {
      setResourceViewError(error.message);
      setResourceViewData({ resources: [] });
      setSelectedResourceDay(null);
    } finally {
      setIsLoadingResourceView(false);
    }
  }

  async function loadProjectView() {
    const { startDate, endDate } = projectViewRange;

    if (!projectViewProjectId || !startDate || !endDate || new Date(endDate) < new Date(startDate)) {
      setProjectViewData({ resources: [], daily_totals: [] });
      return;
    }

    setIsLoadingProjectView(true);
    setProjectViewError('');

    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const response = await apiFetch(`${apiBaseUrl}/projects/${projectViewProjectId}/workload?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload?.data || !Array.isArray(payload.data.resources)) {
        throw new Error(payload?.error?.message ?? 'Unable to load project view workload.');
      }

      setProjectViewData(payload.data);
    } catch (error) {
      setProjectViewError(error.message);
      setProjectViewData({ resources: [], daily_totals: [] });
    } finally {
      setIsLoadingProjectView(false);
    }
  }

  useEffect(() => {
    if (!authToken) {
      return;
    }

    loadResourceView();
  }, [authToken, resourceViewRange.endDate, resourceViewRange.startDate]);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    loadProjectView();
  }, [authToken, projectViewProjectId, projectViewRange.endDate, projectViewRange.startDate]);

  useEffect(() => {
    if (!authToken) {
      return;
    }

    loadResources();
    loadProjects();
    loadAllocations();
    loadUsers();
    loadCurrentUser();
  }, [authToken]);

  function handleResourceFormChange(event) {
    const { name, type, value, checked } = event.target;

    setResourceFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function handleProjectFormChange(event) {
    const { name, type, value, checked } = event.target;

    setProjectFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function handleAllocationFormChange(event) {
    const { name, value } = event.target;

    setAllocationFormData((current) => ({
      ...current,
      [name]: value
    }));
  }

  function resetProjectForm() {
    setEditingProjectId('');
    setProjectFormData(defaultProjectForm);
    setProjectFormError('');
  }

  function resetResourceForm() {
    setEditingResourceId('');
    setResourceFormData(defaultResourceForm);
    setResourceFormError('');
  }

  function resetAllocationForm() {
    setEditingAllocationId('');
    setAllocationFormData(defaultAllocationForm);
    setAllocationFormError('');
  }

  function startCreateProject() {
    resetProjectForm();
    setProjectFormSuccess('');
    setCreateModal('project');
  }

  function startCreateResource() {
    resetResourceForm();
    setResourceFormSuccess('');
    setCreateModal('resource');
  }

  function startEditResource(resource) {
    setEditingResourceId(resource.id);
    setResourceFormData({
      name: resource.name,
      capacity_hours: String(resource.capacity_hours ?? 8),
      is_active: resource.is_active
    });
    setResourceFormError('');
    setResourceFormSuccess(`Editing ${resource.name}.`);
    setActiveView('resource-edit');
  }

  function startEditProject(project) {
    setEditingProjectId(project.id);
    setProjectFormData({
      name: project.name,
      color: project.color ?? '#346a55',
      hours_type: project.hours_type ?? 'BILLABLE',
      is_active: project.is_active
    });
    setProjectFormError('');
    setProjectFormSuccess(`Editing ${project.name}.`);
    setActiveView('project-edit');
  }

  function startCreateAllocation() {
    resetAllocationForm();
    setAllocationFormSuccess('');
    setCreateModal('allocation');
  }

  function startEditAllocation(allocation) {
    setEditingAllocationId(allocation.id);
    setAllocationFormData({
      resource_id: allocation.resource_id,
      project_id: allocation.project_id,
      start_date: toDateInputValue(allocation.start_date),
      end_date: toDateInputValue(allocation.end_date),
      hours_per_day: String(allocation.hours_per_day)
    });
    setAllocationFormError('');
    setAllocationFormSuccess('Editing allocation.');
    setActiveView('allocation-edit');
  }

  function openProjectList() {
    resetProjectForm();
    setCreateModal('');
    setActiveView('project-list');
  }

  function openResourceList() {
    resetResourceForm();
    setCreateModal('');
    setActiveView('resource-list');
  }

  function openAllocationList() {
    resetAllocationForm();
    setCreateModal('');
    setActiveView('allocation-list');
  }

  function closeCreateModal() {
    if (createModal === 'resource') {
      resetResourceForm();
    }

    if (createModal === 'project') {
      resetProjectForm();
    }

    if (createModal === 'allocation') {
      resetAllocationForm();
    }

    setCreateModal('');
  }

  function validateResourceForm() {
    if (!resourceFormData.name.trim()) {
      return 'Please enter a resource name.';
    }

    const capacityHours = Number(resourceFormData.capacity_hours);

    if (!Number.isFinite(capacityHours) || capacityHours < 1 || capacityHours > 24) {
      return 'Capacity hours must be a number from 1 to 24.';
    }

    return '';
  }

  function validateProjectForm() {
    if (!projectFormData.name.trim()) {
      return 'Please enter a project name.';
    }

    return '';
  }

  function validateAllocationForm() {
    if (!allocationFormData.resource_id) {
      return 'Please select a resource.';
    }

    if (!allocationFormData.project_id) {
      return 'Please select a project.';
    }

    if (!allocationFormData.start_date || !allocationFormData.end_date) {
      return 'Please enter both start date and end date.';
    }

    if (allocationFormData.end_date < allocationFormData.start_date) {
      return 'End date must be on or after start date.';
    }

    const numericHours = Number(allocationFormData.hours_per_day);

    if (!Number.isFinite(numericHours) || numericHours <= 0) {
      return 'Hours per day must be a number greater than 0.';
    }

    return '';
  }

  async function handleResourceSubmit(event) {
    event.preventDefault();
    setResourceFormError('');
    setResourceFormSuccess('');

    const validationError = validateResourceForm();

    if (validationError) {
      setResourceFormError(validationError);
      return;
    }

    setIsSavingResource(true);

    const endpoint = isResourceEditMode
      ? `${apiBaseUrl}/resources/${editingResourceId}`
      : `${apiBaseUrl}/resources`;
    const method = isResourceEditMode ? 'PUT' : 'POST';
    const payload = {
      ...resourceFormData,
      name: resourceFormData.name.trim(),
      capacity_hours: Number(resourceFormData.capacity_hours)
    };

    try {
      const response = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responsePayload = await response.json();

      if (!response.ok || !responsePayload?.data) {
        throw new Error(responsePayload?.error?.message ?? 'Unable to save resource.');
      }

      setResourceFormSuccess(isResourceEditMode ? 'Resource updated successfully.' : 'Resource created successfully.');
      resetResourceForm();
      await loadResources();
      await loadResourceView();
      setCreateModal('');
      setActiveView('resource-list');
    } catch (error) {
      setResourceFormError(error.message);
    } finally {
      setIsSavingResource(false);
    }
  }

  async function handleProjectSubmit(event) {
    event.preventDefault();
    setProjectFormError('');
    setProjectFormSuccess('');

    const validationError = validateProjectForm();

    if (validationError) {
      setProjectFormError(validationError);
      return;
    }

    setIsSavingProject(true);

    const endpoint = isProjectEditMode
      ? `${apiBaseUrl}/projects/${editingProjectId}`
      : `${apiBaseUrl}/projects`;
    const method = isProjectEditMode ? 'PUT' : 'POST';

    try {
      const response = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectFormData)
      });
      const payload = await response.json();

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? 'Unable to save project.');
      }

      const successMessage = isProjectEditMode
        ? `${payload.data.name} updated successfully.`
        : `${payload.data.name} created successfully.`;

      setProjectFormSuccess(successMessage);
      resetProjectForm();
      await loadProjects();
      await loadProjectView();
      setCreateModal('');
      setActiveView('project-list');
    } catch (error) {
      setProjectFormError(error.message);
    } finally {
      setIsSavingProject(false);
    }
  }

  async function handleAllocationSubmit(event) {
    event.preventDefault();
    setAllocationFormError('');
    setAllocationFormSuccess('');

    const validationError = validateAllocationForm();

    if (validationError) {
      setAllocationFormError(validationError);
      return;
    }

    setIsSavingAllocation(true);

    const endpoint = isAllocationEditMode
      ? `${apiBaseUrl}/allocations/${editingAllocationId}`
      : `${apiBaseUrl}/allocations`;
    const method = isAllocationEditMode ? 'PUT' : 'POST';

    const payload = {
      ...allocationFormData,
      hours_per_day: Number(allocationFormData.hours_per_day)
    };

    try {
      const response = await apiFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const responsePayload = await response.json();

      if (!response.ok || !responsePayload?.data) {
        throw new Error(responsePayload?.error?.message ?? 'Unable to save allocation.');
      }

      setAllocationFormSuccess(isAllocationEditMode ? 'Allocation updated successfully.' : 'Allocation created successfully.');
      resetAllocationForm();
      await loadAllocations();
      await loadResourceView();
      await loadProjectView();
      setCreateModal('');
      setActiveView('allocation-list');
    } catch (error) {
      setAllocationFormError(error.message);
    } finally {
      setIsSavingAllocation(false);
    }
  }

  async function handleAllocationDelete(allocationId) {
    setAllocationFormError('');
    setAllocationFormSuccess('');

    try {
      const response = await apiFetch(`${apiBaseUrl}/allocations/${allocationId}`, {
        method: 'DELETE'
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'Unable to delete allocation.');
      }

      setAllocationFormSuccess('Allocation deleted successfully.');
      await loadAllocations();
      await loadResourceView();
      await loadProjectView();
    } catch (error) {
      setAllocationFormError(error.message);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setUserError('');

    try {
      const response = await apiFetch(`${apiBaseUrl}/users`);
      const payload = await response.json();

      if (!response.ok || !Array.isArray(payload?.data)) {
        throw new Error(payload?.error?.message ?? 'Unable to load users.');
      }

      setUsers(payload.data);
    } catch (error) {
      setUserError(error.message);
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadCurrentUser() {
    try {
      const response = await apiFetch(`${apiBaseUrl}/auth/me`);
      const payload = await response.json();

      if (response.ok && payload?.data) {
        setCurrentUser(payload.data);
      }
    } catch (_error) {
      setCurrentUser(null);
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginFormData)
      });
      const payload = await response.json();

      if (!response.ok || !payload?.data?.token) {
        throw new Error(payload?.error?.message ?? 'Unable to sign in.');
      }

      localStorage.setItem('rp_auth_token', payload.data.token);
      setAuthToken(payload.data.token);
      setCurrentUser(payload.data.user);
      setLoginFormData({ email: '', password: '' });
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handlePasswordSetupSubmit(event) {
    event.preventDefault();
    setPasswordSetupError('');
    setIsSettingPassword(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/auth/password-setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: setupToken,
          password: passwordSetupFormData.password,
          confirm_password: passwordSetupFormData.confirm_password
        })
      });
      const payload = await response.json();

      if (!response.ok || !payload?.data?.token) {
        throw new Error(payload?.error?.message ?? 'Unable to set password.');
      }

      localStorage.setItem('rp_auth_token', payload.data.token);
      window.history.replaceState({}, document.title, window.location.pathname);
      setAuthToken(payload.data.token);
      setCurrentUser(payload.data.user);
      setSetupToken('');
      setPasswordSetupFormData({ password: '', confirm_password: '' });
    } catch (error) {
      setPasswordSetupError(error.message);
    } finally {
      setIsSettingPassword(false);
    }
  }

  async function handleLogout() {
    try {
      await apiFetch(`${apiBaseUrl}/auth/logout`, { method: 'POST' });
    } finally {
      localStorage.removeItem('rp_auth_token');
      setAuthToken('');
      setCurrentUser(null);
    }
  }

  async function handleUserSubmit(event) {
    event.preventDefault();
    setUserFormError('');
    setUserFormSuccess('');
    setLatestInviteUrl('');
    setIsSavingUser(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userFormData.email })
      });
      const payload = await response.json();

      if (!response.ok || !payload?.data?.user) {
        throw new Error(payload?.error?.message ?? 'Unable to create user.');
      }

      setUserFormSuccess(`${payload.data.user.email} created as Admin.`);
      setLatestInviteUrl(payload.data.invitation?.setup_url ?? '');
      setUserFormData({ email: '' });
      await loadUsers();
    } catch (error) {
      setUserFormError(error.message);
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleResendInvite(userId) {
    setUserFormError('');
    setUserFormSuccess('');
    setLatestInviteUrl('');

    try {
      const response = await apiFetch(`${apiBaseUrl}/users/${userId}/resend-invite`, { method: 'POST' });
      const payload = await response.json();

      if (!response.ok || !payload?.data?.invitation) {
        throw new Error(payload?.error?.message ?? 'Unable to resend invite.');
      }

      setUserFormSuccess(`Invitation refreshed for ${payload.data.user.email}.`);
      setLatestInviteUrl(payload.data.invitation.setup_url);
      await loadUsers();
    } catch (error) {
      setUserFormError(error.message);
    }
  }

  async function handleDisableUser(userId) {
    setUserFormError('');
    setUserFormSuccess('');

    try {
      const response = await apiFetch(`${apiBaseUrl}/users/${userId}/disable`, { method: 'POST' });
      const payload = await response.json();

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? 'Unable to disable user.');
      }

      setUserFormSuccess(`${payload.data.email} disabled.`);
      await loadUsers();
    } catch (error) {
      setUserFormError(error.message);
    }
  }

  async function handleRemoveUser() {
    if (!userPendingRemoval) {
      return;
    }

    setUserFormError('');
    setUserFormSuccess('');
    setIsRemovingUser(true);

    try {
      const response = await apiFetch(`${apiBaseUrl}/users/${userPendingRemoval.id}`, { method: 'DELETE' });
      const payload = await response.json();

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? 'Unable to remove user.');
      }

      setUserFormSuccess(`${payload.data.email} removed.`);
      setUserPendingRemoval(null);
      await loadUsers();
    } catch (error) {
      setUserFormError(error.message);
    } finally {
      setIsRemovingUser(false);
    }
  }

  const isResourceFormView = activeView === 'resource-edit';
  const isProjectFormView = activeView === 'project-edit';
  const isAllocationFormView = activeView === 'allocation-edit';
  const weekdayColumns = useMemo(
    () => getWeekdaysInRange(resourceViewRange.startDate, resourceViewRange.endDate),
    [resourceViewRange.endDate, resourceViewRange.startDate]
  );
  const projectViewWeekdayColumns = useMemo(
    () => getWeekdaysInRange(projectViewRange.startDate, projectViewRange.endDate),
    [projectViewRange.endDate, projectViewRange.startDate]
  );

  const resourceDailyWorkloadById = useMemo(() => {
    return resourceViewData.resources.reduce((resourceAcc, resource) => {
      resourceAcc[resource.resource_id] = resource.daily_workload.reduce((dayAcc, day) => {
        dayAcc[day.date] = day;
        return dayAcc;
      }, {});
      return resourceAcc;
    }, {});
  }, [resourceViewData.resources]);

  const resourceHasSelectedProjectWork = useMemo(() => {
    if (!selectedProjectFilterId) {
      return {};
    }

    return resourceViewData.resources.reduce((resourceAcc, resource) => {
      resourceAcc[resource.resource_id] = resource.daily_workload.some((day) =>
        day.project_breakdown.some(
          (project) => project.project_id === selectedProjectFilterId && Number(project.hours ?? 0) > 0
        )
      );
      return resourceAcc;
    }, {});
  }, [resourceViewData.resources, selectedProjectFilterId]);

  const filteredResourceRows = useMemo(() => {
    const searchValue = resourceSearchText.trim().toLowerCase();

    return resources.filter((resource) => {
      const matchesSearch = !searchValue || resource.name.toLowerCase().includes(searchValue);
      const matchesProject = !selectedProjectFilterId || resourceHasSelectedProjectWork[resource.id];

      return matchesSearch && matchesProject;
    });
  }, [resourceHasSelectedProjectWork, resourceSearchText, resources, selectedProjectFilterId]);

  const resourceViewHoursTypeTotals = useMemo(() => {
    const totals = {
      billable: 0,
      nonBillable: 0
    };

    for (const resource of resourceViewData.resources) {
      for (const day of resource.daily_workload) {
        for (const project of day.project_breakdown) {
          const hours = Number(project.hours ?? 0);

          if (project.project_hours_type === 'NON_BILLABLE') {
            totals.nonBillable += hours;
          } else {
            totals.billable += hours;
          }
        }
      }
    }

    return totals;
  }, [resourceViewData.resources]);

  function getDisplayWorkloadDay(workloadDay) {
    if (!workloadDay || !selectedProjectFilterId) {
      return workloadDay;
    }

    const projectBreakdown = workloadDay.project_breakdown.filter(
      (project) => project.project_id === selectedProjectFilterId
    );
    const plannedHours = projectBreakdown.reduce((total, project) => total + Number(project.hours ?? 0), 0);

    return {
      ...workloadDay,
      planned_hours: plannedHours,
      project_breakdown: projectBreakdown
    };
  }

  const selectedResourceDayTotal = useMemo(() => {
    if (!selectedResourceDay) {
      return 0;
    }

    return selectedResourceDay.projectBreakdown.reduce((total, project) => total + Number(project.hours ?? 0), 0);
  }, [selectedResourceDay]);

  const projectViewDailyWorkloadByResourceId = useMemo(() => {
    return projectViewData.resources.reduce((resourceAcc, resource) => {
      resourceAcc[resource.resource_id] = resource.daily_workload.reduce((dayAcc, day) => {
        dayAcc[day.date] = day;
        return dayAcc;
      }, {});
      return resourceAcc;
    }, {});
  }, [projectViewData.resources]);

  const projectViewDailyTotalsByDate = useMemo(() => {
    return projectViewData.daily_totals.reduce((dailyTotalsAcc, day) => {
      dailyTotalsAcc[day.date] = day.planned_hours;
      return dailyTotalsAcc;
    }, {});
  }, [projectViewData.daily_totals]);

  const filteredProjectViewResources = useMemo(() => {
    const searchValue = projectViewResourceSearchText.trim().toLowerCase();

    if (!searchValue) {
      return projectViewData.resources;
    }

    return projectViewData.resources.filter((resource) =>
      (resource.resource_name ?? 'Unknown resource').toLowerCase().includes(searchValue)
    );
  }, [projectViewData.resources, projectViewResourceSearchText]);

  const selectedProjectViewProject = useMemo(() => {
    return projects.find((project) => project.id === projectViewProjectId) ?? null;
  }, [projectViewProjectId, projects]);

  async function apiFetch(url, options = {}) {
    const headers = {
      ...(options.headers ?? {})
    };

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('rp_auth_token');
      setAuthToken('');
      setCurrentUser(null);
    }

    return response;
  }

  if (setupToken && !authToken) {
    return (
      <main className="app auth-shell">
        <section className="panel auth-panel" aria-label="Set password">
          <div className="auth-brand">
            <img src={wlcmLogo} alt="WLCM" className="brand-logo brand-logo--auth" />
            <h1>Set Password</h1>
          </div>
          <p className="muted">Create your Admin password to activate your account.</p>
          <form className="project-form" onSubmit={handlePasswordSetupSubmit} noValidate>
            <label>
              Password
              <input
                type="password"
                value={passwordSetupFormData.password}
                onChange={(event) =>
                  setPasswordSetupFormData((current) => ({ ...current, password: event.target.value }))
                }
                minLength={12}
                required
              />
            </label>
            <label>
              Confirm password
              <input
                type="password"
                value={passwordSetupFormData.confirm_password}
                onChange={(event) =>
                  setPasswordSetupFormData((current) => ({ ...current, confirm_password: event.target.value }))
                }
                minLength={12}
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isSettingPassword}>
                {isSettingPassword ? 'Saving...' : 'Set password'}
              </button>
            </div>
          </form>
          {passwordSetupError && <p className="error">{passwordSetupError}</p>}
        </section>
      </main>
    );
  }

  if (!authToken) {
    return (
      <main className="app auth-shell">
        <section className="panel auth-panel" aria-label="Sign in">
          <div className="auth-brand">
            <img src={wlcmLogo} alt="WLCM" className="brand-logo brand-logo--auth" />
            <h1>Resource Planning</h1>
          </div>
          <p className="muted">Sign in with an active Admin account.</p>
          <form className="project-form" onSubmit={handleLoginSubmit} noValidate>
            <label>
              Email
              <input
                type="email"
                value={loginFormData.email}
                onChange={(event) => setLoginFormData((current) => ({ ...current, email: event.target.value }))}
                required
                autoFocus
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={loginFormData.password}
                onChange={(event) => setLoginFormData((current) => ({ ...current, password: event.target.value }))}
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
          {loginError && <p className="error">{loginError}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app__header">
        <div className="brand-lockup">
          <img src={wlcmLogo} alt="WLCM" className="brand-logo" />
          <div>
            <h1>Resource Planning</h1>
            <p className="muted">Manage resources, projects, and date-based allocations.</p>
          </div>
        </div>
        <div className="session-summary">
          <span>{currentUser?.email ?? 'Admin'}</span>
          <button type="button" className="secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="panel view-nav" aria-label="Pages">
        <button
          type="button"
          className={activeView === 'project-list' ? 'secondary active' : 'secondary'}
          onClick={openProjectList}
        >
          Project list
        </button>
        <button
          type="button"
          className={activeView === 'resource-list' ? 'secondary active' : 'secondary'}
          onClick={openResourceList}
        >
          Resource list
        </button>
        <button
          type="button"
          className={activeView === 'allocation-list' ? 'secondary active' : 'secondary'}
          onClick={openAllocationList}
        >
          Allocation list
        </button>
        <button
          type="button"
          className={activeView === 'project-view' ? 'secondary active' : 'secondary'}
          onClick={() => setActiveView('project-view')}
        >
          Project view
        </button>
        <button
          type="button"
          className={activeView === 'resource-view' ? 'secondary active' : 'secondary'}
          onClick={() => setActiveView('resource-view')}
        >
          Resource view
        </button>
        <button
          type="button"
          className={activeView === 'users' ? 'secondary active nav-users' : 'secondary nav-users'}
          onClick={() => setActiveView('users')}
        >
          Users
        </button>
      </nav>

      {activeView === 'users' && (
        <section className="panel" aria-label="Users">
          <div className="section-header">
            <div>
              <h2>Users</h2>
              <p className="muted">All MVP users are Admins. New users stay Pending until they set a password.</p>
            </div>
          </div>

          <form className="project-form user-create-form" onSubmit={handleUserSubmit} noValidate>
            <label>
              Email
              <input
                type="email"
                value={userFormData.email}
                onChange={(event) => setUserFormData({ email: event.target.value })}
                placeholder="admin@example.com"
                required
              />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={isSavingUser}>
                {isSavingUser ? 'Creating...' : 'Create user'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setUserFormData({ email: '' });
                  setUserFormError('');
                  setUserFormSuccess('');
                  setLatestInviteUrl('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>

          {userFormSuccess && <p className="success">{userFormSuccess}</p>}
          {latestInviteUrl && (
            <p className="invite-url">
              Invite link: <code>{latestInviteUrl}</code>
            </p>
          )}
          {userFormError && <p className="error">{userFormError}</p>}
          {userError && <p className="error">{userError}</p>}
          {loadingUsers && <p>Loading users...</p>}

          {!loadingUsers && !userError && (
            <div className="allocation-table-wrapper users-table-wrapper">
              <table className="allocation-table">
                <thead>
                  <tr>
                    <th scope="col">Email</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Created At</th>
                    <th scope="col">Last Login</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && (
                    <tr>
                      <td colSpan="6">No users found.</td>
                    </tr>
                  )}
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>
                        <span className={`status ${user.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td>{user.created_at ? new Date(user.created_at).toLocaleString() : '-'}</td>
                      <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '-'}</td>
                      <td>
                        <div className="form-actions">
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleDisableUser(user.id)}
                            disabled={user.status === 'DISABLED'}
                          >
                            Disable
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => handleResendInvite(user.id)}
                            disabled={user.status !== 'PENDING'}
                          >
                            Resend invite
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => setUserPendingRemoval(user)}
                            disabled={user.id === currentUser?.id}
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {isResourceFormView && (
        <section className="panel" aria-label="Resource form">
          <h2>{isResourceEditMode ? 'Edit resource' : 'Create resource'}</h2>
          <form onSubmit={handleResourceSubmit} className="project-form" noValidate>
            <label>
              Resource name
              <input
                name="name"
                value={resourceFormData.name}
                onChange={handleResourceFormChange}
                placeholder="e.g. Alice Johnson"
                required
                maxLength={120}
              />
            </label>

            <label>
              Capacity hours
              <input
                type="number"
                min="1"
                max="24"
                step="0.25"
                name="capacity_hours"
                value={resourceFormData.capacity_hours}
                onChange={handleResourceFormChange}
                required
              />
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                name="is_active"
                checked={resourceFormData.is_active}
                onChange={handleResourceFormChange}
              />
              Active
            </label>

            <div className="form-actions">
              <button type="submit" disabled={isSavingResource}>
                {isSavingResource ? 'Saving...' : isResourceEditMode ? 'Save changes' : 'Create resource'}
              </button>
              <button type="button" className="secondary" onClick={openResourceList}>
                Cancel
              </button>
            </div>
          </form>
          {resourceFormError && <p className="error">{resourceFormError}</p>}
          {resourceFormSuccess && <p className="success">{resourceFormSuccess}</p>}
        </section>
      )}

      {activeView === 'resource-list' && (
        <section className="panel" aria-label="Resource list">
          <div className="section-header">
            <h2>Resource list</h2>
            <button type="button" onClick={startCreateResource}>
              Create resource
            </button>
          </div>
          {resourceFormSuccess && <p className="success">{resourceFormSuccess}</p>}
          {loadingResources && <p>Loading resources...</p>}
          {resourceError && <p className="error">{resourceError}</p>}

          {!loadingResources && !resourceError && (
            <ul className="project-list">
              {resources.length === 0 && (
                <li className="empty empty-with-action">
                  No resources found.
                  <button type="button" className="secondary" onClick={startCreateResource}>
                    Create resource
                  </button>
                </li>
              )}
              {resources.map((resource) => (
                <li key={resource.id}>
                  <div>
                    <p className="name">{resource.name}</p>
                    <p className={`status ${resource.is_active ? 'active' : 'inactive'}`}>
                      {statusLabel(resource.is_active)} | {resource.capacity_hours}h/day
                    </p>
                  </div>
                  <button type="button" className="secondary" onClick={() => startEditResource(resource)}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isProjectFormView && (
        <section className="panel" aria-label="Project form">
          <h2>{isProjectEditMode ? 'Edit project' : 'Create project'}</h2>
          <form onSubmit={handleProjectSubmit} className="project-form" noValidate>
            <label>
              Project name
              <input
                name="name"
                value={projectFormData.name}
                onChange={handleProjectFormChange}
                placeholder="e.g. RM Platform Revamp"
                required
                maxLength={120}
              />
            </label>

            <label>
              Project color
              <div className="color-picker-field">
                <input
                  type="color"
                  name="color"
                  value={projectFormData.color}
                  onChange={handleProjectFormChange}
                  aria-label="Project color"
                />
                <input
                  name="color"
                  value={projectFormData.color}
                  onChange={handleProjectFormChange}
                  pattern="#[0-9a-fA-F]{6}"
                  aria-label="Project color hex"
                />
              </div>
            </label>

            <label>
              Hours type
              <select name="hours_type" value={projectFormData.hours_type} onChange={handleProjectFormChange}>
                <option value="BILLABLE">Billable</option>
                <option value="NON_BILLABLE">Non billable</option>
              </select>
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                name="is_active"
                checked={projectFormData.is_active}
                onChange={handleProjectFormChange}
              />
              Active
            </label>

            <div className="form-actions">
              <button type="submit" disabled={isSavingProject}>
                {isSavingProject ? 'Saving...' : isProjectEditMode ? 'Save changes' : 'Create project'}
              </button>
              <button type="button" className="secondary" onClick={openProjectList}>
                Cancel
              </button>
            </div>
          </form>
          {projectFormError && <p className="error">{projectFormError}</p>}
          {projectFormSuccess && <p className="success">{projectFormSuccess}</p>}
        </section>
      )}

      {activeView === 'project-list' && (
        <section className="panel" aria-label="Project list">
          <div className="section-header">
            <h2>Project list</h2>
            <button type="button" onClick={startCreateProject}>
              Create project
            </button>
          </div>
          {projectFormSuccess && <p className="success">{projectFormSuccess}</p>}
          {loadingProjects && <p>Loading projects...</p>}
          {projectError && <p className="error">{projectError}</p>}

          {!loadingProjects && !projectError && (
            <ul className="project-list">
              {projects.length === 0 && (
                <li className="empty empty-with-action">
                  No projects found.
                  <button type="button" className="secondary" onClick={startCreateProject}>
                    Create project
                  </button>
                </li>
              )}
              {projects.map((project) => (
                <li key={project.id}>
                  <div>
                    <p className="name project-name-with-color">
                      <span
                        className="project-color-dot"
                        style={{ '--project-color': project.color ?? '#346a55' }}
                        aria-hidden="true"
                      />
                      {project.name}
                    </p>
                    <p className={`status ${project.is_active ? 'active' : 'inactive'}`}>
                      {statusLabel(project.is_active)} | {hoursTypeLabel(project.hours_type)}
                    </p>
                  </div>
                  <button type="button" className="secondary" onClick={() => startEditProject(project)}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isAllocationFormView && (
        <section className="panel" aria-label="Allocation form">
          <h2>{isAllocationEditMode ? 'Edit allocation' : 'Create allocation'}</h2>
          <form onSubmit={handleAllocationSubmit} className="project-form" noValidate>
            <label>
              Resource
              <select
                name="resource_id"
                value={allocationFormData.resource_id}
                onChange={handleAllocationFormChange}
                required
              >
                <option value="">Select a resource</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Project
              <select
                name="project_id"
                value={allocationFormData.project_id}
                onChange={handleAllocationFormChange}
                required
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Start date
              <input
                type="date"
                name="start_date"
                value={allocationFormData.start_date}
                onChange={handleAllocationFormChange}
                required
              />
            </label>

            <label>
              End date
              <input
                type="date"
                name="end_date"
                value={allocationFormData.end_date}
                onChange={handleAllocationFormChange}
                required
              />
            </label>

            <label>
              Hours per day
              <input
                type="number"
                min="0.25"
                max="24"
                step="0.25"
                name="hours_per_day"
                value={allocationFormData.hours_per_day}
                onChange={handleAllocationFormChange}
                required
              />
            </label>

            <div className="form-actions">
              <button type="submit" disabled={isSavingAllocation || loadingResources || loadingProjects}>
                {isSavingAllocation ? 'Saving...' : isAllocationEditMode ? 'Save changes' : 'Create allocation'}
              </button>
              <button type="button" className="secondary" onClick={openAllocationList}>
                Cancel
              </button>
            </div>
          </form>

          {loadingResources && <p>Loading resources...</p>}
          {loadingProjects && <p>Loading projects...</p>}
          {resourceError && <p className="error">{resourceError}</p>}
          {projectError && <p className="error">{projectError}</p>}
          {allocationFormError && <p className="error">{allocationFormError}</p>}
          {allocationFormSuccess && <p className="success">{allocationFormSuccess}</p>}
        </section>
      )}

      {activeView === 'allocation-list' && (
        <section className="panel" aria-label="Allocation list">
          <div className="section-header">
            <div>
              <h2>Allocation list</h2>
              <p className="muted">Review and manage existing allocations outside planning views.</p>
            </div>
            <button type="button" onClick={startCreateAllocation}>
              Create allocation
            </button>
          </div>
          {allocationFormSuccess && <p className="success">{allocationFormSuccess}</p>}
          {allocationFormError && <p className="error">{allocationFormError}</p>}
          {allocationError && <p className="error">{allocationError}</p>}
          {loadingAllocations && <p>Loading allocations...</p>}

          {!loadingAllocations && !allocationError && (
            <>
              {allocations.length === 0 && (
                <div className="empty empty-with-action">
                  No allocations found.
                  <button type="button" className="secondary" onClick={startCreateAllocation}>
                    Create allocation
                  </button>
                </div>
              )}
              {allocations.length > 0 && (
                <div className="allocation-table-wrapper">
                  <table className="allocation-table">
                    <thead>
                      <tr>
                        <th scope="col">Resource</th>
                        <th scope="col">Project</th>
                        <th scope="col">Date range</th>
                        <th scope="col">Hours/day</th>
                        <th scope="col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocations.map((allocation) => (
                        <tr key={allocation.id}>
                          <td>{resourceNameById[allocation.resource_id] ?? 'Unknown resource'}</td>
                          <td>{projectNameById[allocation.project_id] ?? 'Unknown project'}</td>
                          <td>{formatDateRange(allocation.start_date, allocation.end_date)}</td>
                          <td>{allocation.hours_per_day}</td>
                          <td>
                            <div className="form-actions">
                              <button type="button" className="secondary" onClick={() => startEditAllocation(allocation)}>
                                Edit
                              </button>
                              <button type="button" onClick={() => handleAllocationDelete(allocation.id)}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {activeView === 'project-view' && (
        <section className="panel" aria-label="Project View">
          <h2>Project View</h2>
          <p className="muted">Review staffing for a selected project across weekday columns.</p>
          <form className="resource-range-form" onSubmit={(event) => event.preventDefault()}>
            <label className="project-view-selector">
              Project
              <select
                value={projectViewProjectId}
                onChange={(event) => {
                  setProjectViewProjectId(event.target.value);
                  setProjectViewError('');
                }}
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Start date
              <input
                type="date"
                value={projectViewRange.startDate}
                onChange={(event) =>
                  setProjectViewRange((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={projectViewRange.endDate}
                onChange={(event) =>
                  setProjectViewRange((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </label>
            <label className="project-view-search-field">
              Search resources
              <input
                type="search"
                value={projectViewResourceSearchText}
                onChange={(event) => setProjectViewResourceSearchText(event.target.value)}
                placeholder="Type a resource name"
              />
            </label>
          </form>

          {loadingProjects && <p>Loading projects...</p>}
          {projectError && <p className="error">{projectError}</p>}
          {projectViewError && <p className="error">{projectViewError}</p>}
          {isLoadingProjectView && <p>Loading project view...</p>}

          {!projectViewProjectId && !loadingProjects && projects.length === 0 && (
            <p className="empty">Create a project before opening the project staffing view.</p>
          )}
          {!projectViewProjectId && !loadingProjects && projects.length > 0 && (
            <p className="empty">Select a project to view staffing.</p>
          )}

          {projectViewProjectId && !isLoadingProjectView && !projectViewError && (
            <div className="resource-grid-wrapper">
              {projectViewWeekdayColumns.length === 0 ? (
                <p className="empty">No weekdays found in this date range.</p>
              ) : projectViewData.resources.length === 0 ? (
                <div className="empty empty-with-action">
                  No resources are allocated to {selectedProjectViewProject?.name ?? 'this project'} in this date range.
                  <button type="button" className="secondary" onClick={startCreateAllocation}>
                    Create allocation
                  </button>
                </div>
              ) : filteredProjectViewResources.length === 0 ? (
                <p className="empty">No resources match this search.</p>
              ) : (
                <table className="resource-grid">
                  <thead>
                    <tr>
                      <th scope="col">Resource</th>
                      {projectViewWeekdayColumns.map((column) => (
                        <th scope="col" key={column.key}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjectViewResources.map((resource) => (
                      <tr key={resource.resource_id}>
                        <th scope="row">{resource.resource_name ?? 'Unknown resource'}</th>
                        {projectViewWeekdayColumns.map((column) => {
                          const workloadDay = projectViewDailyWorkloadByResourceId[resource.resource_id]?.[column.date];
                          const plannedHours = workloadDay?.planned_hours ?? 0;
                          const projectName = selectedProjectViewProject?.name ?? 'selected project';
                          const projectColor = selectedProjectViewProject?.color ?? '#346a55';

                          return (
                            <td
                              key={`${resource.resource_id}-${column.date}`}
                              aria-label={`${resource.resource_name ?? 'Unknown resource'} has ${plannedHours}h on ${column.label} for ${projectName}`}
                              title={plannedHours > 0 ? `${projectName}: ${plannedHours}h` : undefined}
                            >
                              <span
                                className={plannedHours > 0 ? 'project-cell-value project-cell-value--filled' : 'resource-cell-empty'}
                                style={plannedHours > 0 ? { '--slot-color': projectColor, '--slot-background': projectColor } : undefined}
                              >
                                {plannedHours > 0 ? `${plannedHours}h` : '0h'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="project-total-row">
                      <th scope="row">Daily total</th>
                      {projectViewWeekdayColumns.map((column) => {
                        const plannedHours = projectViewDailyTotalsByDate[column.date] ?? 0;

                        return (
                          <td
                            key={`project-total-${column.date}`}
                            aria-label={`${plannedHours}h total planned on ${column.label} for ${selectedProjectViewProject?.name ?? 'selected project'}`}
                            title={plannedHours > 0 ? `${selectedProjectViewProject?.name ?? 'selected project'}: ${plannedHours}h` : undefined}
                          >
                            <span
                              className={plannedHours > 0 ? 'project-cell-value project-cell-value--filled' : 'resource-cell-empty'}
                              style={plannedHours > 0 ? { '--slot-color': selectedProjectViewProject?.color ?? '#346a55', '--slot-background': selectedProjectViewProject?.color ?? '#346a55' } : undefined}
                            >
                              {plannedHours > 0 ? `${plannedHours}h` : '0h'}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {activeView === 'resource-view' && (
        <section className="panel" aria-label="Resource View">
          <h2>Resource View</h2>
          <p className="muted">Plan work by resource across weekday columns only.</p>
          <form className="resource-range-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              Start date
              <input
                type="date"
                value={resourceViewRange.startDate}
                onChange={(event) => {
                  setSelectedResourceDay(null);
                  setResourceViewRange((current) => ({ ...current, startDate: event.target.value }));
                }}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={resourceViewRange.endDate}
                onChange={(event) => {
                  setSelectedResourceDay(null);
                  setResourceViewRange((current) => ({ ...current, endDate: event.target.value }));
                }}
              />
            </label>
            <label className="resource-search-field">
              Search resources
              <input
                type="search"
                value={resourceSearchText}
                onChange={(event) => {
                  setSelectedResourceDay(null);
                  setResourceSearchText(event.target.value);
                }}
                placeholder="Type a resource name"
              />
            </label>
            <label className="resource-project-filter">
              Project filter
              <select
                value={selectedProjectFilterId}
                onChange={(event) => {
                  setSelectedResourceDay(null);
                  setSelectedProjectFilterId(event.target.value);
                }}
              >
                <option value="">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          </form>
          {resourceError && <p className="error">{resourceError}</p>}
          {resourceViewError && <p className="error">{resourceViewError}</p>}
          {(loadingResources || isLoadingResourceView) && <p>Loading resources...</p>}
          {!loadingResources && !isLoadingResourceView && !resourceError && !resourceViewError && (
            <div className="resource-grid-wrapper">
              {weekdayColumns.length === 0 ? (
                <p className="empty">No weekdays found in this date range.</p>
              ) : resources.length === 0 ? (
                <div className="empty empty-with-action">
                  Create resources before planning workload.
                  <button type="button" className="secondary" onClick={startCreateResource}>
                    Create resource
                  </button>
                </div>
              ) : filteredResourceRows.length === 0 ? (
                <p className="empty">No resources match the current filters.</p>
              ) : (
                <table className="resource-grid">
                  <thead>
                    <tr>
                      <th scope="col">Resource</th>
                      {weekdayColumns.map((column) => (
                        <th scope="col" key={column.key}>
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredResourceRows.map((resource) => (
                      <tr key={resource.id}>
                        <th scope="row">{resource.name}</th>
                        {weekdayColumns.map((column) => {
                          const workloadDay = getDisplayWorkloadDay(resourceDailyWorkloadById[resource.id]?.[column.date]);
                          const plannedHours = workloadDay?.planned_hours ?? 0;
                          const projectBreakdown = workloadDay?.project_breakdown ?? [];
                          const isPopulated = plannedHours > 0;
                          const isSelected =
                            selectedResourceDay?.resourceId === resource.id && selectedResourceDay?.date === column.date;
                          const slotTitle = getProjectSlotTitle(projectBreakdown);
                          const slotStyle = getProjectSlotStyle(projectBreakdown);

                          return (
                            <td
                              key={`${resource.id}-${column.date}`}
                              aria-label={`${resource.name} ${column.label}`}
                              className={isPopulated ? 'resource-grid__cell--populated' : undefined}
                              title={slotTitle || undefined}
                            >
                              {isPopulated ? (
                                <button
                                  type="button"
                                  className={isSelected ? 'resource-cell active' : 'resource-cell'}
                                  style={slotStyle}
                                  title={slotTitle}
                                  onClick={() =>
                                    setSelectedResourceDay({
                                      resourceId: resource.id,
                                      resourceName: resource.name,
                                      date: column.date,
                                      dateLabel: column.label,
                                      plannedHours,
                                      projectBreakdown
                                    })
                                  }
                                >
                                  {plannedHours}h
                                </button>
                              ) : (
                                <span className="resource-cell-empty">0h</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {!loadingResources && !isLoadingResourceView && !resourceError && !resourceViewError && (
            <section className="hours-summary" aria-label="Billable and non billable hours summary">
              <div>
                <p className="hours-summary__label">Billable hours</p>
                <p className="hours-summary__value">{resourceViewHoursTypeTotals.billable}h</p>
              </div>
              <div>
                <p className="hours-summary__label">Non billable hours</p>
                <p className="hours-summary__value">{resourceViewHoursTypeTotals.nonBillable}h</p>
              </div>
            </section>
          )}
          {selectedResourceDay && (
            <aside className="breakdown-panel" aria-live="polite">
              <div className="breakdown-panel__header">
                <div>
                  <h3>{selectedResourceDay.resourceName}</h3>
                  <p className="muted">{selectedResourceDay.dateLabel}</p>
                </div>
                <button type="button" className="secondary" onClick={() => setSelectedResourceDay(null)}>
                  Close
                </button>
              </div>

              <table className="breakdown-table">
                <thead>
                  <tr>
                    <th scope="col">Project</th>
                    <th scope="col">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedResourceDay.projectBreakdown.map((project) => (
                    <tr key={project.project_id}>
                      <td>
                        <span
                          className="project-color-dot"
                          style={{ '--project-color': project.project_color ?? '#346a55' }}
                          aria-hidden="true"
                        />
                        {project.project_name ?? 'Unknown project'}
                      </td>
                      <td>{project.hours}h</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    <td>{selectedResourceDayTotal}h</td>
                  </tr>
                </tfoot>
              </table>
            </aside>
          )}
        </section>
      )}

      {createModal === 'resource' && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-resource-title">
            <div className="modal__header">
              <h2 id="create-resource-title">Create resource</h2>
              <button type="button" className="secondary" onClick={closeCreateModal} aria-label="Close create resource">
                Close
              </button>
            </div>
            <form onSubmit={handleResourceSubmit} className="project-form" noValidate>
              <label>
                Resource name
                <input
                  name="name"
                  value={resourceFormData.name}
                  onChange={handleResourceFormChange}
                  placeholder="e.g. Alice Johnson"
                  required
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label>
                Capacity hours
                <input
                  type="number"
                  min="1"
                  max="24"
                  step="0.25"
                  name="capacity_hours"
                  value={resourceFormData.capacity_hours}
                  onChange={handleResourceFormChange}
                  required
                />
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={resourceFormData.is_active}
                  onChange={handleResourceFormChange}
                />
                Active
              </label>

              <div className="form-actions">
                <button type="submit" disabled={isSavingResource}>
                  {isSavingResource ? 'Saving...' : 'Create resource'}
                </button>
                <button type="button" className="secondary" onClick={closeCreateModal}>
                  Cancel
                </button>
              </div>
            </form>
            {resourceFormError && <p className="error">{resourceFormError}</p>}
          </section>
        </div>
      )}

      {createModal === 'project' && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
            <div className="modal__header">
              <h2 id="create-project-title">Create project</h2>
              <button type="button" className="secondary" onClick={closeCreateModal} aria-label="Close create project">
                Close
              </button>
            </div>
            <form onSubmit={handleProjectSubmit} className="project-form" noValidate>
              <label>
                Project name
                <input
                  name="name"
                  value={projectFormData.name}
                  onChange={handleProjectFormChange}
                  placeholder="e.g. RM Platform Revamp"
                  required
                  maxLength={120}
                  autoFocus
                />
              </label>

              <label>
                Project color
                <div className="color-picker-field">
                  <input
                    type="color"
                    name="color"
                    value={projectFormData.color}
                    onChange={handleProjectFormChange}
                    aria-label="Project color"
                  />
                  <input
                    name="color"
                    value={projectFormData.color}
                    onChange={handleProjectFormChange}
                    pattern="#[0-9a-fA-F]{6}"
                    aria-label="Project color hex"
                  />
                </div>
              </label>

              <label>
                Hours type
                <select name="hours_type" value={projectFormData.hours_type} onChange={handleProjectFormChange}>
                  <option value="BILLABLE">Billable</option>
                  <option value="NON_BILLABLE">Non billable</option>
                </select>
              </label>

              <label className="checkbox">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={projectFormData.is_active}
                  onChange={handleProjectFormChange}
                />
                Active
              </label>

              <div className="form-actions">
                <button type="submit" disabled={isSavingProject}>
                  {isSavingProject ? 'Saving...' : 'Create project'}
                </button>
                <button type="button" className="secondary" onClick={closeCreateModal}>
                  Cancel
                </button>
              </div>
            </form>
            {projectFormError && <p className="error">{projectFormError}</p>}
          </section>
        </div>
      )}

      {createModal === 'allocation' && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="create-allocation-title">
            <div className="modal__header">
              <h2 id="create-allocation-title">Create allocation</h2>
              <button
                type="button"
                className="secondary"
                onClick={closeCreateModal}
                aria-label="Close create allocation"
              >
                Close
              </button>
            </div>
            <form onSubmit={handleAllocationSubmit} className="project-form" noValidate>
              <label>
                Resource
                <select
                  name="resource_id"
                  value={allocationFormData.resource_id}
                  onChange={handleAllocationFormChange}
                  required
                  autoFocus
                >
                  <option value="">Select a resource</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Project
                <select
                  name="project_id"
                  value={allocationFormData.project_id}
                  onChange={handleAllocationFormChange}
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Start date
                <input
                  type="date"
                  name="start_date"
                  value={allocationFormData.start_date}
                  onChange={handleAllocationFormChange}
                  required
                />
              </label>

              <label>
                End date
                <input
                  type="date"
                  name="end_date"
                  value={allocationFormData.end_date}
                  onChange={handleAllocationFormChange}
                  required
                />
              </label>

              <label>
                Hours per day
                <input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  name="hours_per_day"
                  value={allocationFormData.hours_per_day}
                  onChange={handleAllocationFormChange}
                  required
                />
              </label>

              <div className="form-actions">
                <button type="submit" disabled={isSavingAllocation || loadingResources || loadingProjects}>
                  {isSavingAllocation ? 'Saving...' : 'Create allocation'}
                </button>
                <button type="button" className="secondary" onClick={closeCreateModal}>
                  Cancel
                </button>
              </div>
            </form>

            {loadingResources && <p>Loading resources...</p>}
            {loadingProjects && <p>Loading projects...</p>}
            {resourceError && <p className="error">{resourceError}</p>}
            {projectError && <p className="error">{projectError}</p>}
            {allocationFormError && <p className="error">{allocationFormError}</p>}
          </section>
        </div>
      )}

      {userPendingRemoval && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="remove-user-title">
            <div className="modal__header">
              <div>
                <h2 id="remove-user-title">Remove user</h2>
                <p className="muted">This action permanently removes the user from the system.</p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={() => setUserPendingRemoval(null)}
                aria-label="Close remove user confirmation"
                disabled={isRemovingUser}
              >
                Close
              </button>
            </div>

            <p>
              Remove <strong>{userPendingRemoval.email}</strong>?
            </p>

            <div className="form-actions confirmation-actions">
              <button type="button" className="danger" onClick={handleRemoveUser} disabled={isRemovingUser}>
                {isRemovingUser ? 'Removing...' : 'Remove user'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => setUserPendingRemoval(null)}
                disabled={isRemovingUser}
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
