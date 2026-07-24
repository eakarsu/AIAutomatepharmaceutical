import React, { useEffect, useState } from 'react';
import api from '../../services/api';

// NON-VIZ: Full CRUD editor for recipes/formulations (ingredient % + process params).
function RecipeEditor() {
  const [recipes, setRecipes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);

  const blankRecipe = () => ({
    name: 'New Recipe',
    version: '0.1',
    status: 'Draft',
    batch_size_kg: 100,
    ingredients: [
      { material: 'API', pct: 80, function: 'Active' },
      { material: 'Microcrystalline Cellulose', pct: 18, function: 'Diluent' },
      { material: 'Magnesium Stearate', pct: 2, function: 'Lubricant' },
    ],
    process_parameters: { granulation_min: 12, drying_target_lod_pct: 2.0 },
  });

  const load = async () => {
    setLoading(true); setErr(null);
    try {
      const r = await api.get('/custom-views/recipes');
      setRecipes(r.data.data || []);
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startNew = () => { setEditing(blankRecipe()); setSelected(null); setMsg(null); };
  const startEdit = (r) => { setEditing(JSON.parse(JSON.stringify(r))); setSelected(r.id); setMsg(null); };

  const updateField = (k, v) => setEditing({ ...editing, [k]: v });
  const updateIngredient = (i, k, v) => {
    const ing = [...editing.ingredients];
    ing[i] = { ...ing[i], [k]: k === 'pct' ? parseFloat(v) || 0 : v };
    setEditing({ ...editing, ingredients: ing });
  };
  const addIngredient = () => setEditing({
    ...editing, ingredients: [...editing.ingredients, { material: 'New', pct: 0, function: 'Excipient' }]
  });
  const removeIngredient = (i) => setEditing({
    ...editing, ingredients: editing.ingredients.filter((_, j) => j !== i)
  });

  const save = async () => {
    setLoading(true); setErr(null); setMsg(null);
    try {
      if (editing.id) {
        const r = await api.put(`/custom-views/recipes/${editing.id}`, editing);
        setMsg(`Recipe #${r.data.id} updated.`);
      } else {
        const r = await api.post('/custom-views/recipes', editing);
        setMsg(`Recipe #${r.data.id} created.`);
        setEditing(r.data);
        setSelected(r.data.id);
      }
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this recipe?')) return;
    setLoading(true); setErr(null);
    try {
      await api.delete(`/custom-views/recipes/${id}`);
      setMsg(`Recipe #${id} deleted.`);
      if (editing?.id === id) { setEditing(null); setSelected(null); }
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  };

  const sumPct = editing ? editing.ingredients.reduce((a, i) => a + (Number(i.pct) || 0), 0) : 0;

  const fStyle = { padding: 6, borderRadius: 4, background: '#1e293b', color: '#e2e8f0', border: '1px solid #334155' };

  return (
    <div style={{ background: '#0f172a', borderRadius: 8, padding: 20, color: '#e2e8f0' }}>
      <h3 style={{ marginTop: 0, color: '#60a5fa' }}>Recipe / Formulation Editor</h3>
      <p style={{ fontSize: 13, color: '#94a3b8' }}>
        Define ingredients, percentages, and process parameters for pharmaceutical products. CRUD-backed.
      </p>

      {err && <div style={{ color: '#f87171', marginBottom: 10 }}>Error: {err}</div>}
      {msg && <div style={{ color: '#22c55e', marginBottom: 10 }}>{msg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16 }}>
        <div style={{ background: '#0b1220', borderRadius: 6, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <b>Recipes ({recipes.length})</b>
            <button onClick={startNew}
              style={{ padding: '4px 10px', borderRadius: 4, border: 0, background: '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
              + New
            </button>
          </div>
          {loading && <div style={{ color: '#94a3b8' }}>Loading...</div>}
          {recipes.map((r) => (
            <div key={r.id}
              onClick={() => startEdit(r)}
              style={{
                padding: 8, marginBottom: 6, borderRadius: 4, cursor: 'pointer',
                background: selected === r.id ? '#1e40af' : '#1e293b',
              }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>
                v{r.version} - {r.status} - {r.batch_size_kg}kg
              </div>
              <button onClick={(e) => { e.stopPropagation(); remove(r.id); }}
                style={{ marginTop: 4, padding: '2px 6px', borderRadius: 3, border: 0, background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 10 }}>
                Delete
              </button>
            </div>
          ))}
        </div>

        <div style={{ background: '#0b1220', borderRadius: 6, padding: 16 }}>
          {!editing && (
            <div style={{ color: '#94a3b8', fontSize: 13 }}>
              Select a recipe to edit, or click "+ New" to create one.
            </div>
          )}
          {editing && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>Name
                  <input value={editing.name} onChange={(e) => updateField('name', e.target.value)} style={{ ...fStyle, width: '100%' }} />
                </label>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>Version
                  <input value={editing.version} onChange={(e) => updateField('version', e.target.value)} style={{ ...fStyle, width: '100%' }} />
                </label>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>Status
                  <select value={editing.status} onChange={(e) => updateField('status', e.target.value)} style={{ ...fStyle, width: '100%' }}>
                    <option>Draft</option><option>Approved</option><option>Retired</option>
                  </select>
                </label>
                <label style={{ fontSize: 11, color: '#94a3b8' }}>Batch (kg)
                  <input type="number" value={editing.batch_size_kg}
                    onChange={(e) => updateField('batch_size_kg', parseFloat(e.target.value) || 0)} style={{ ...fStyle, width: '100%' }} />
                </label>
              </div>

              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b>Ingredients</b>
                <span style={{ color: Math.abs(sumPct - 100) < 0.5 ? '#22c55e' : '#f87171', fontSize: 12 }}>
                  Sum: {sumPct.toFixed(2)}% {Math.abs(sumPct - 100) < 0.5 ? '(OK)' : '(must be 100%)'}
                </span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
                <thead>
                  <tr style={{ background: '#1e293b' }}>
                    <th style={{ padding: 6, textAlign: 'left', fontSize: 11, color: '#94a3b8' }}>Material</th>
                    <th style={{ padding: 6, textAlign: 'right', fontSize: 11, color: '#94a3b8' }}>%</th>
                    <th style={{ padding: 6, textAlign: 'left', fontSize: 11, color: '#94a3b8' }}>Function</th>
                    <th style={{ padding: 6, width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {editing.ingredients.map((ing, i) => (
                    <tr key={i}>
                      <td style={{ padding: 4 }}>
                        <input value={ing.material} onChange={(e) => updateIngredient(i, 'material', e.target.value)} style={{ ...fStyle, width: '100%' }} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input type="number" step="0.1" value={ing.pct} onChange={(e) => updateIngredient(i, 'pct', e.target.value)}
                          style={{ ...fStyle, width: 80, textAlign: 'right' }} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <input value={ing.function} onChange={(e) => updateIngredient(i, 'function', e.target.value)} style={{ ...fStyle, width: '100%' }} />
                      </td>
                      <td style={{ padding: 4 }}>
                        <button onClick={() => removeIngredient(i)}
                          style={{ padding: '4px 8px', borderRadius: 3, border: 0, background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: 11 }}>
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addIngredient}
                style={{ padding: '6px 12px', borderRadius: 4, border: 0, background: '#334155', color: '#fff', cursor: 'pointer', fontSize: 12, marginBottom: 14 }}>
                + Add Ingredient
              </button>

              <div style={{ marginBottom: 14 }}>
                <b>Process Parameters (JSON)</b>
                <textarea
                  value={JSON.stringify(editing.process_parameters || {}, null, 2)}
                  onChange={(e) => {
                    try { updateField('process_parameters', JSON.parse(e.target.value)); } catch (_) { /* keep typing */ }
                  }}
                  rows={5}
                  style={{ ...fStyle, width: '100%', fontFamily: 'monospace', fontSize: 12 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={save} disabled={loading}
                  style={{ padding: '8px 18px', borderRadius: 4, border: 0, background: '#3b82f6', color: '#fff', cursor: 'pointer' }}>
                  {loading ? 'Saving...' : editing.id ? 'Update Recipe' : 'Create Recipe'}
                </button>
                <button onClick={() => { setEditing(null); setSelected(null); }}
                  style={{ padding: '8px 18px', borderRadius: 4, border: 0, background: '#475569', color: '#fff', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default RecipeEditor;
