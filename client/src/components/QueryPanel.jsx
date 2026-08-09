import { useState } from 'react';
import { runQuery } from '../api.js';

function modeLabel(result) {
  if (result.provider) return result.provider;
  if (result.mode === 'groq') return 'Groq';
  if (result.mode === 'openai') return 'OpenAI';
  return 'Rules engine';
}

export default function QueryPanel({ enabled }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!enabled) return null;

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await runQuery(question);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel query-panel-highlight">
      <div className="panel-head">
        <div>
          <h2>Division intelligence query</h2>
          <p className="muted tight">Ask across ORBAT, equipment holdings, and recent events</p>
        </div>
        <span className="pill ok">AI assisted</span>
      </div>
      <form onSubmit={submit} className="query-form">
        <label htmlFor="question">Question</label>
        <textarea
          id="question"
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about readiness, equipment, or formations…"
        />
        <div className="query-actions">
          <button type="submit" className="primary-btn" disabled={loading || !question.trim()}>
            {loading ? 'Running…' : 'Ask'}
          </button>
        </div>
      </form>
      {error && <div className="banner error">{error}</div>}
      {result && (
        <div className="query-result">
          <div className="query-result-meta">
            <span className="pill ok">{modeLabel(result)}</span>
            {result.model && <span className="pill">{result.model}</span>}
          </div>
          <p className="answer">{result.answer}</p>

          {Array.isArray(result.sources) && result.sources.length > 0 && (
            <div className="sources-block">
              <h3 className="sources-title">Context used</h3>
              <div className="sources-grid">
                {result.sources.map((src) => (
                  <div key={src.label} className="source-card">
                    <strong>{src.label}</strong>
                    <span>{src.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(result.evidence_rows) && result.evidence_rows.length > 0 && (
            <div className="sources-block">
              <h3 className="sources-title">Supporting data</h3>
              <div className="table-wrap evidence-table">
                <table>
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Item</th>
                      <th>Held / Auth</th>
                      <th>Serviceable / Present</th>
                      <th>Deployed / Ready %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.evidence_rows.map((row, idx) => (
                      <tr key={`${row.item}-${idx}`}>
                        <td>{row.category}</td>
                        <td>{row.item}</td>
                        <td>{row.held}</td>
                        <td>{row.serviceable}</td>
                        <td>{row.deployed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
