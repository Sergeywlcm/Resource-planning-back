import { useEffect, useMemo, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const defaultProjectForm = {
  name: '',
  is_active: true
};

function statusLabel(isActive) {
  return isActive ? 'Active' : 'Inactive';
}

export default function App() {
  const [resources, setResources] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [resourceError, setResourceError] = useState('');
  const [projectError, setProjectError] = useState('');

  const [projectFormData, setProjectFormData] = useState(defaultProjectForm);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [projectFormError, setProjectFormError] = useState('');
  const [projectFormSuccess, setProjectFormSuccess] = useState('');
  const [activeView, setActiveView] = useState('project-list');

  const [allocationDraft, setAllocationDraft] = useState({
    project_id: '',
    resource_id: ''
  });

  const isEditMode = useMemo(() => Boolean(editingProjectId), [editingProjectId]);

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

  useEffect(() => {
    loadResources();
    loadProjects();
  }, []);

  function handleProjectFormChange(event) {
    const { name, type, value, checked } = event.target;

    setProjectFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value
    }));
  }

  function handleAllocationDraftChange(event) {
    const { name, value } = event.target;

    setAllocationDraft((current) => ({
      ...current,
      [name]: value
    }));
  }

  function resetProjectForm() {
    setEditingProjectId('');
    setProjectFormData(defaultProjectForm);
    setProjectFormError('');
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

  function openProjectList() {
    resetProjectForm();
    setActiveView('project-list');
  }

  async function handleProjectSubmit(event) {
    event.preventDefault();
    setIsSavingProject(true);
    setProjectFormError('');
    setProjectFormSuccess('');

    const endpoint = isEditMode
      ? `${apiBaseUrl}/projects/${editingProjectId}`
      : `${apiBaseUrl}/projects`;
    const method = isEditMode ? 'PUT' : 'POST';

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

      const successMessage = isEditMode
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

  const isProjectFormView = activeView === 'project-create' || activeView === 'project-edit';

  return (
    <main className="app">
      <header className="app__header">
        <h1>Project Management</h1>
        <p className="muted">View, create, and edit projects used for resource allocations.</p>
      </header>

      <nav className="panel view-nav" aria-label="Project pages">
        <button
          type="button"
          className={activeView === 'project-list' ? 'secondary active' : 'secondary'}
          onClick={openProjectList}
        >
          Project list page
        </button>
        <button
          type="button"
          className={activeView === 'project-create' ? 'secondary active' : 'secondary'}
          onClick={startCreateProject}
        >
          Create project page
        </button>
      </nav>

      {isProjectFormView && (
        <section className="panel" aria-label="Project form">
          <h2>{isEditMode ? 'Edit project' : 'Create project'}</h2>
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
                {isSavingProject ? 'Saving...' : isEditMode ? 'Save changes' : 'Create project'}
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
        <>
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

          <section className="panel" aria-label="Allocation form selectors">
            <h2>Allocation form selectors</h2>
            <p className="muted">Projects are available here immediately after they are saved.</p>
            <form className="project-form" onSubmit={(event) => event.preventDefault()}>
              <label>
                Project
                <select
                  name="project_id"
                  value={allocationDraft.project_id}
                  onChange={handleAllocationDraftChange}
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
                Resource
                <select
                  name="resource_id"
                  value={allocationDraft.resource_id}
                  onChange={handleAllocationDraftChange}
                >
                  <option value="">Select a resource</option>
                  {resources.map((resource) => (
                    <option key={resource.id} value={resource.id}>
                      {resource.name}
                    </option>
                  ))}
                </select>
              </label>
            </form>
            {loadingResources && <p>Loading resources for selector...</p>}
            {resourceError && <p className="error">{resourceError}</p>}
          </section>
        </>
      )}
    </main>
  );
}
