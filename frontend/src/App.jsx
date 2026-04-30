import { useEffect, useMemo, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api';

const defaultProjectForm = {
  name: '',
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

function toDateInputValue(rawValue) {
  if (!rawValue) {
    return '';
  }

  return new Date(rawValue).toISOString().slice(0, 10);
}

function formatDateRange(startDate, endDate) {
  return `${toDateInputValue(startDate)} → ${toDateInputValue(endDate)}`;
}

function getDefaultRange() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(start.getDate() + 13);

  return {
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end)
  };
}

function isWeekday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function getWeekdaysInRange(startDate, endDate) {
  if (!startDate || !endDate || endDate < startDate) {
    return [];
  }

  const days = [];
  const cursor = new Date(startDate);
  const rangeEnd = new Date(endDate);

  while (cursor <= rangeEnd) {
    if (isWeekday(cursor)) {
      days.push({
        key: cursor.toISOString(),
        date: toDateInputValue(cursor),
        label: cursor.toLocaleDateString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export default function App() {
  const [resources, setResources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [allocations, setAllocations] = useState([]);

  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [loadingAllocations, setLoadingAllocations] = useState(true);

  const [resourceError, setResourceError] = useState('');
  const [projectError, setProjectError] = useState('');
  const [allocationError, setAllocationError] = useState('');

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

  const [activeView, setActiveView] = useState('project-list');
  const [resourceViewRange, setResourceViewRange] = useState(getDefaultRange);
  const [resourceViewData, setResourceViewData] = useState({ resources: [] });
  const [isLoadingResourceView, setIsLoadingResourceView] = useState(false);
  const [resourceViewError, setResourceViewError] = useState('');

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
      const response = await fetch(`${apiBaseUrl}/resources`);
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
      const response = await fetch(`${apiBaseUrl}/projects`);
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
      const response = await fetch(`${apiBaseUrl}/allocations`);
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
      return;
    }

    setIsLoadingResourceView(true);
    setResourceViewError('');

    try {
      const params = new URLSearchParams({ start: startDate, end: endDate });
      const response = await fetch(`${apiBaseUrl}/resources/workload?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok || !payload?.data || !Array.isArray(payload.data.resources)) {
        throw new Error(payload?.error?.message ?? 'Unable to load resource view workload.');
      }

      setResourceViewData(payload.data);
    } catch (error) {
      setResourceViewError(error.message);
      setResourceViewData({ resources: [] });
    } finally {
      setIsLoadingResourceView(false);
    }
  }

  useEffect(() => {
    loadResourceView();
  }, [resourceViewRange.endDate, resourceViewRange.startDate]);

  useEffect(() => {
    loadResources();
    loadProjects();
    loadAllocations();
  }, []);

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

  function resetAllocationForm() {
    setEditingAllocationId('');
    setAllocationFormData(defaultAllocationForm);
    setAllocationFormError('');
  }

  function startCreateProject() {
    resetProjectForm();
    setProjectFormSuccess('');
    setActiveView('project-create');
  }

  function startEditProject(project) {
    setEditingProjectId(project.id);
    setProjectFormData({
      name: project.name,
      is_active: project.is_active
    });
    setProjectFormError('');
    setProjectFormSuccess(`Editing ${project.name}.`);
    setActiveView('project-edit');
  }

  function startCreateAllocation() {
    resetAllocationForm();
    setAllocationFormSuccess('');
    setActiveView('allocation-create');
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
    setActiveView('project-list');
  }

  function openAllocationList() {
    resetAllocationForm();
    setActiveView('allocation-list');
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

  async function handleProjectSubmit(event) {
    event.preventDefault();
    setIsSavingProject(true);
    setProjectFormError('');
    setProjectFormSuccess('');

    const endpoint = isProjectEditMode
      ? `${apiBaseUrl}/projects/${editingProjectId}`
      : `${apiBaseUrl}/projects`;
    const method = isProjectEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
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
      const response = await fetch(endpoint, {
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
      const response = await fetch(`${apiBaseUrl}/allocations/${allocationId}`, {
        method: 'DELETE'
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error?.message ?? 'Unable to delete allocation.');
      }

      setAllocationFormSuccess('Allocation deleted successfully.');
      await loadAllocations();
    } catch (error) {
      setAllocationFormError(error.message);
    }
  }

  const isProjectFormView = activeView === 'project-create' || activeView === 'project-edit';
  const isAllocationFormView = activeView === 'allocation-create' || activeView === 'allocation-edit';
  const weekdayColumns = useMemo(
    () => getWeekdaysInRange(resourceViewRange.startDate, resourceViewRange.endDate),
    [resourceViewRange.endDate, resourceViewRange.startDate]
  );

  const resourceDailyHoursById = useMemo(() => {
    return resourceViewData.resources.reduce((resourceAcc, resource) => {
      resourceAcc[resource.resource_id] = resource.daily_workload.reduce((dayAcc, day) => {
        dayAcc[day.date] = day.planned_hours;
        return dayAcc;
      }, {});
      return resourceAcc;
    }, {});
  }, [resourceViewData.resources]);

  return (
    <main className="app">
      <header className="app__header">
        <h1>Resource Planning</h1>
        <p className="muted">Manage projects and create, edit, and delete allocations.</p>
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
          className={activeView === 'project-create' ? 'secondary active' : 'secondary'}
          onClick={startCreateProject}
        >
          Create project
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
          className={activeView === 'allocation-create' ? 'secondary active' : 'secondary'}
          onClick={startCreateAllocation}
        >
          Create allocation
        </button>
        <button
          type="button"
          className={activeView === 'resource-view' ? 'secondary active' : 'secondary'}
          onClick={() => setActiveView('resource-view')}
        >
          Resource view
        </button>
      </nav>

      {isProjectFormView && (
        <section className="panel" aria-label="Project form">
          <h2>{isProjectEditMode ? 'Edit project' : 'Create project'}</h2>
          <form onSubmit={handleProjectSubmit} className="project-form">
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
          <h2>Project list</h2>
          {projectFormSuccess && <p className="success">{projectFormSuccess}</p>}
          {loadingProjects && <p>Loading projects...</p>}
          {projectError && <p className="error">{projectError}</p>}

          {!loadingProjects && !projectError && (
            <ul className="project-list">
              {projects.length === 0 && <li className="empty">No projects found.</li>}
              {projects.map((project) => (
                <li key={project.id}>
                  <div>
                    <p className="name">{project.name}</p>
                    <p className={`status ${project.is_active ? 'active' : 'inactive'}`}>
                      {statusLabel(project.is_active)}
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
          <form onSubmit={handleAllocationSubmit} className="project-form">
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
          <h2>Allocation list</h2>
          <p className="muted">Review and manage existing allocations outside planning views.</p>
          {allocationFormSuccess && <p className="success">{allocationFormSuccess}</p>}
          {allocationFormError && <p className="error">{allocationFormError}</p>}
          {allocationError && <p className="error">{allocationError}</p>}
          {loadingAllocations && <p>Loading allocations...</p>}

          {!loadingAllocations && !allocationError && (
            <>
              {allocations.length === 0 && <p className="empty">No allocations found.</p>}
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
                onChange={(event) =>
                  setResourceViewRange((current) => ({ ...current, startDate: event.target.value }))
                }
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={resourceViewRange.endDate}
                onChange={(event) =>
                  setResourceViewRange((current) => ({ ...current, endDate: event.target.value }))
                }
              />
            </label>
          </form>
          {resourceError && <p className="error">{resourceError}</p>}
          {resourceViewError && <p className="error">{resourceViewError}</p>}
          {(loadingResources || isLoadingResourceView) && <p>Loading resources...</p>}
          {!loadingResources && !isLoadingResourceView && !resourceError && !resourceViewError && (
            <div className="resource-grid-wrapper">
              {weekdayColumns.length === 0 ? (
                <p className="empty">No weekdays found in this date range.</p>
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
                    {resources.map((resource) => (
                      <tr key={resource.id}>
                        <th scope="row">{resource.name}</th>
                        {weekdayColumns.map((column) => {
                          const plannedHours = resourceDailyHoursById[resource.id]?.[column.date] ?? 0;

                          return (
                            <td key={`${resource.id}-${column.date}`} aria-label={`${resource.name} ${column.label}`}>
                              {plannedHours > 0 ? `${plannedHours}h` : '0h'}
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
        </section>
      )}
    </main>
  );
}
