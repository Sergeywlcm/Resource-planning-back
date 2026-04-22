import { useEffect, useMemo, useState } from 'react';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';

const defaultForm = {
  name: '',
  capacity_hours: 8,
  is_active: true
};

function statusLabel(isActive) {
  return isActive ? 'Active' : 'Inactive';
}

export default function App() {
  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [resourceError, setResourceError] = useState('');

  const [formData, setFormData] = useState(defaultForm);
  const [editingResourceId, setEditingResourceId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [activeView, setActiveView] = useState('list');

  const isEditMode = useMemo(() => Boolean(editingResourceId), [editingResourceId]);

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

  useEffect(() => {
    loadResources();
  }, []);

  function handleChange(event) {
    const { name, type, value, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : type === 'number' ? Number(value) : value
    }));
  }

  function resetForm() {
    setEditingResourceId('');
    setFormData(defaultForm);
    setFormError('');
  }

  function startCreate() {
    resetForm();
    setFormSuccess('');
    setActiveView('create');
  }

  function startEdit(resource) {
    setEditingResourceId(resource.id);
    setFormData({
      name: resource.name,
      capacity_hours: resource.capacity_hours,
      is_active: resource.is_active
    });
    setFormError('');
    setFormSuccess(`Editing ${resource.name}.`);
    setActiveView('edit');
  }

  function openList() {
    resetForm();
    setActiveView('list');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);
    setFormError('');
    setFormSuccess('');

    const endpoint = isEditMode
      ? `${apiBaseUrl}/resources/${editingResourceId}`
      : `${apiBaseUrl}/resources`;
    const method = isEditMode ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const payload = await response.json();

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.error?.message ?? 'Unable to save resource.');
      }

      const successMessage = isEditMode
        ? `${payload.data.name} updated successfully.`
        : `${payload.data.name} created successfully.`;

      setFormSuccess(successMessage);
      resetForm();
      await loadResources();
      setActiveView('list');
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  const isFormView = activeView === 'create' || activeView === 'edit';

  return (
    <main className="app">
      <header className="app__header">
        <h1>Resource Management</h1>
        <p className="muted">Create, edit, and track resource availability.</p>
      </header>

      <nav className="panel view-nav" aria-label="Resource pages">
        <button
          type="button"
          className={activeView === 'list' ? 'secondary active' : 'secondary'}
          onClick={openList}
        >
          Resource list page
        </button>
        <button
          type="button"
          className={activeView === 'create' ? 'secondary active' : 'secondary'}
          onClick={startCreate}
        >
          Create resource page
        </button>
      </nav>

      {isFormView && (
        <section className="panel" aria-label="Resource form">
          <h2>{isEditMode ? 'Edit resource' : 'Create resource'}</h2>
          <form onSubmit={handleSubmit} className="resource-form">
            <label>
              Resource name
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g. Backend Engineer"
                required
                maxLength={120}
              />
            </label>

            <label>
              Capacity hours
              <input
                type="number"
                name="capacity_hours"
                min={1}
                max={24}
                value={formData.capacity_hours}
                onChange={handleChange}
              />
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleChange}
              />
              Active
            </label>

            <div className="form-actions">
              <button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : isEditMode ? 'Save changes' : 'Create resource'}
              </button>
              <button type="button" className="secondary" onClick={openList}>
                Cancel
              </button>
            </div>
          </form>
          {formError && <p className="error">{formError}</p>}
          {formSuccess && <p className="success">{formSuccess}</p>}
        </section>
      )}

      {activeView === 'list' && (
        <section className="panel" aria-label="Resource list">
          <h2>Resource list</h2>
          {formSuccess && <p className="success">{formSuccess}</p>}
          {loadingResources && <p>Loading resources...</p>}
          {resourceError && <p className="error">{resourceError}</p>}

          {!loadingResources && !resourceError && (
            <ul className="resource-list">
              {resources.length === 0 && <li className="empty">No resources found.</li>}
              {resources.map((resource) => (
                <li key={resource.id}>
                  <div>
                    <p className="name">{resource.name}</p>
                    <p className={`status ${resource.is_active ? 'active' : 'inactive'}`}>
                      {statusLabel(resource.is_active)}
                    </p>
                  </div>
                  <button type="button" className="secondary" onClick={() => startEdit(resource)}>
                    Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
